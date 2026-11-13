// src/api/authApi.js — real calls to /auth/*, replacing the old
// localStorage-only fake authService.
import { apiClient, tokenStorage } from "./client";

export const authApi = {
  async register({ full_name, email, phone_number, password, role = "patient" }) {
    const { data } = await apiClient.post("/auth/register", {
      full_name,
      email,
      phone_number,
      password,
      role,
    });
    return data; // UserProfileResponse
  },

  async login({ email, password }) {
    // /auth/login-json accepts a simple JSON body — the plain /auth/login
    // route exists only for Swagger's OAuth2 "Authorize" button (it needs
    // form-encoded username/password per the OAuth2 password flow spec).
    const { data } = await apiClient.post("/auth/login-json", { email, password });

    tokenStorage.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    const profile = await authApi.getProfile();
    tokenStorage.setUser(profile);
    return { tokens: data, user: profile };
  },

  async googleLogin(idToken) {
    const { data } = await apiClient.post("/auth/google", { id_token: idToken });
    tokenStorage.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    const profile = await authApi.getProfile();
    tokenStorage.setUser(profile);
    return { tokens: data, user: profile };
  },

  async logout() {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Best-effort server-side revocation; always clear local state.
    } finally {
      tokenStorage.clear();
    }
  },

  async getProfile() {
    const { data } = await apiClient.get("/auth/profile");
    return data;
  },

  async updateLanguage(preferred_language) {
    const { data } = await apiClient.put("/auth/profile/language", { preferred_language });
    tokenStorage.setUser(data);
    return data;
  },

  async changePassword({ old_password, new_password }) {
    const { data } = await apiClient.post("/auth/change-password", { old_password, new_password });
    return data;
  },

  isAuthenticated() {
    return Boolean(tokenStorage.getAccessToken());
  },
};
