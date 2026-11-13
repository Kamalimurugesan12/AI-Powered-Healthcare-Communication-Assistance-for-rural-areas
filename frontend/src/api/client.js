// src/api/client.js — single axios instance used by every service module.
//
// Talks to the unified FastAPI backend (see /backend). Handles:
//   - attaching the access token to every request
//   - transparently refreshing the access token on a 401 and retrying once
//   - logging the user out (and redirecting to /login) if the refresh fails
import axios from "axios";
import { resetLanguageToDefault } from "@/i18n/config";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "auth_user";

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getUser: () => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setSession: ({ access_token, refresh_token, user }) => {
    if (access_token) localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  setUser: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token available");

  // Deduplicate concurrent refresh attempts (e.g. several requests firing
  // in parallel and all hitting a 401 at once) into a single network call.
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      .then((res) => res.data)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/");

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        const tokens = await refreshAccessToken();
        tokenStorage.setSession(tokens);
        originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        tokenStorage.clear();
        // Session is being forcibly ended (expired/invalid refresh token) —
        // reset the UI language back to English same as an explicit logout,
        // so it doesn't leak into the login page or the next session.
        resetLanguageToDefault();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Normalizes backend error bodies into a readable string.
 * The backend's global handlers return {success:false, error:"<real message>", detail:"<ErrorType>"},
 * so `detail` is often just a class name ("LLMProviderError", "NoTextDetectedError"). The old
 * code preferred `detail`, which showed users that class name instead of the real message.
 */
export function extractErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const data = error?.response?.data;
  if (!data) {
    if (error?.code === "ECONNABORTED") return "The server took too long to respond. Please try again.";
    if (error?.request && !error?.response) {
      return `Cannot reach the server at ${API_BASE_URL}. Is the backend running?`;
    }
    return error?.message || fallback;
  }
  if (Array.isArray(data.detail)) {
    return data.detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  if (typeof data.error === "string" && data.error) return data.error;
  if (typeof data.detail === "string" && data.detail) return data.detail;
  return fallback;
}
