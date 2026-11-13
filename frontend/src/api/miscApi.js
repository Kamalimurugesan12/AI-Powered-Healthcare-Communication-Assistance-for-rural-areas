// src/api/miscApi.js — matches app/api/v1/languages.py and simplify_translate.py
import { apiClient } from "./client";

export const languagesApi = {
  async list() {
    const { data } = await apiClient.get("/languages");
    return data;
  },
};

export const textApi = {
  async simplify({ reportId, text }) {
    const { data } = await apiClient.post("/simplify", { report_id: reportId ?? null, text: text ?? null });
    return data; // SimplifyResponse
  },

  async translate({ reportId, text, targetLanguage }) {
    const { data } = await apiClient.post("/translate", {
      report_id: reportId ?? null,
      text: text ?? null,
      target_language: targetLanguage,
    });
    return data; // TranslateTextResponse
  },
};
