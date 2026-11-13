import { createContext, useCallback, useContext, useEffect, useState } from "react";
import i18n, { LANGUAGE_STORAGE_KEY, resetLanguageToDefault } from "@/i18n/config";

import { authApi } from "@/api/authApi";
import { tokenStorage } from "@/api/client";

const AuthContext = createContext(undefined);

// If the person hasn't explicitly picked a UI language on this device yet,
// default the app's UI language to their saved account preference the
// first time we learn it. Once they change the language from Profile,
// LANGUAGE_STORAGE_KEY is set and this no longer overrides their choice.
function syncInitialUiLanguage(profile) {
  if (!profile?.preferred_language) return;
  try {
    const alreadyChosen = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!alreadyChosen) {
      i18n.changeLanguage(profile.preferred_language);
    }
  } catch {
    // localStorage unavailable — skip silently.
  }
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStorage.getUser());
  const [loading, setLoading] = useState(true);

  // On mount: if we have a token, confirm it's still valid and refresh the
  // cached profile (covers the case where the token survived a refresh but
  // localStorage's cached user is stale).
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!authApi.isAuthenticated()) {
        setLoading(false);
        return;
      }
      try {
        const profile = await authApi.getProfile();
        if (!cancelled) {
          tokenStorage.setUser(profile);
          setUser(profile);
          syncInitialUiLanguage(profile);
        }
      } catch {
        if (!cancelled) {
          tokenStorage.clear();
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: profile } = await authApi.login({ email, password });
    setUser(profile);
    syncInitialUiLanguage(profile);
    return profile;
  }, []);

  const googleLogin = useCallback(async (idToken) => {
    const { user: profile } = await authApi.googleLogin(idToken);
    setUser(profile);
    syncInitialUiLanguage(profile);
    return profile;
  }, []);

  const register = useCallback(async (payload) => {
    return authApi.register(payload);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Reset the UI language before/independent of clearing the user so
      // the language switch happens immediately on logout, even if the
      // logout API call fails (local session is always cleared either way
      // by authApi.logout()'s own finally block).
      resetLanguageToDefault();
      setUser(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await authApi.getProfile();
    tokenStorage.setUser(profile);
    setUser(profile);
    return profile;
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    loading,
    login,
    googleLogin,
    register,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
