// src/api/translateApi.js — matches app/api/v1/simplify_translate.py
//
// Thin wrapper around the existing standalone POST /translate endpoint
// (backend TranslationService). Used as the fallback path for medicine
// names that aren't covered by the frontend's local i18next medicine-name
// dictionary (see src/i18n/medicineTranslation.js), so we still reuse the
// application's existing translation system rather than inventing a new
// one — we just ask the backend instead of the local dictionary.
import { apiClient } from "./client";

export const translateApi = {
  async translateText(text, targetLanguage) {
    const { data } = await apiClient.post("/translate", {
      text,
      target_language: targetLanguage,
    });
    return data.translated_text;
  },
};
