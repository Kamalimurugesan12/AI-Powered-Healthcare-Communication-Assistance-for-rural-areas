// src/api/ocrApi.js — matches app/api/v1/ocr.py
import { apiClient } from "./client";

export const ocrApi = {
  async extract(file) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post("/ocr/extract", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000, // OCR can take a while on larger PDFs
    });
    return data; // MedicalReportResponse — full OCR->NLP->Simplify->Translate pipeline result
  },

  async list() {
    const { data } = await apiClient.get("/ocr");
    return data; // MedicalReportListItem[]
  },

  async get(reportId) {
    const { data } = await apiClient.get(`/ocr/${reportId}`);
    return data; // MedicalReportResponse
  },

  async remove(reportId) {
    const { data } = await apiClient.delete(`/ocr/${reportId}`);
    return data;
  },

  async getSimplified(reportId) {
    const { data } = await apiClient.get(`/ocr/${reportId}/simplified`);
    return data; // SimplifiedReportResponse
  },

  async translate(reportId, targetLanguage) {
    const { data } = await apiClient.post(`/ocr/${reportId}/translate`, {
      target_language: targetLanguage,
    });
    return data; // TranslateResponse
  },
};
