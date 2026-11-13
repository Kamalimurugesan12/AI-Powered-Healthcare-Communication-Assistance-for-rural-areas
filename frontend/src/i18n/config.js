import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import hi from "./locales/hi.json";
import ta from "./locales/ta.json";
import te from "./locales/te.json";
import kn from "./locales/kn.json";

// Local storage key used to persist the user's chosen UI language across
// refreshes / re-opens of the app. Kept separate from any backend-stored
// "preferred_language" (used for report/chatbot content) so switching the
// UI language never touches auth/profile data or API calls.
export const LANGUAGE_STORAGE_KEY = "app_ui_language";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
];

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

function getInitialLanguage() {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && SUPPORTED_CODES.includes(saved)) return saved;
  } catch {
    // localStorage unavailable (e.g. private mode) — fall back silently.
  }
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    ta: { translation: ta },
    te: { translation: te },
    kn: { translation: kn },
  },
  lng: getInitialLanguage(),
  fallbackLng: "en",
  supportedLngs: SUPPORTED_CODES,
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
});

// Persist the language choice whenever it changes, so a refresh or app
// re-open restores the same language (requirement: persistence).
i18n.on("languageChanged", (lng) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    // ignore storage failures
  }
});

// Called on logout (and any other forced-session-end path, e.g. a failed
// token refresh). Clears the persisted UI language choice and switches the
// app back to English immediately, so:
//   - the previous user's language never leaks into the next logged-out
//     session or into another user's session on the same device, and
//   - post-logout pages (login/register/landing) render in English.
// This intentionally does NOT touch the backend `preferred_language`
// stored on the user's profile — that's separate, account-level data and
// is unaffected by this reset.
export function resetLanguageToDefault() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }
  i18n.changeLanguage("en");
}

export default i18n;
