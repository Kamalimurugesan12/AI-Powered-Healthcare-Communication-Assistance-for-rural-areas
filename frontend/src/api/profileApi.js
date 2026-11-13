// src/api/profileApi.js — matches app/api/v1/profile.py and medical_history.py
import { apiClient } from "./client";

export const profileApi = {
  async get() {
    const { data } = await apiClient.get("/profile");
    return data; // PatientProfileResponse
  },

  async update(payload) {
    const { data } = await apiClient.put("/profile", payload);
    return data;
  },

  async listHistory() {
    const { data } = await apiClient.get("/medical-history");
    return data; // MedicalHistoryEntryResponse[]
  },

  async createHistoryEntry(payload) {
    const { data } = await apiClient.post("/medical-history", payload);
    return data;
  },

  async updateHistoryEntry(entryId, payload) {
    const { data } = await apiClient.put(`/medical-history/${entryId}`, payload);
    return data;
  },

  async deleteHistoryEntry(entryId) {
    const { data } = await apiClient.delete(`/medical-history/${entryId}`);
    return data;
  },
};
