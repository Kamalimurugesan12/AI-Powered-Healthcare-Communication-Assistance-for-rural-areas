// src/api/dashboardApi.js — matches app/api/v1/dashboard.py
import { apiClient } from "./client";

export const dashboardApi = {
  async getOverview() {
    const { data } = await apiClient.get("/dashboard");
    return data; // DashboardOverview
  },

  async listNotifications() {
    const { data } = await apiClient.get("/dashboard/notifications");
    return data;
  },

  async markNotificationRead(notificationId) {
    const { data } = await apiClient.put(`/dashboard/notifications/${notificationId}/read`);
    return data;
  },
};
