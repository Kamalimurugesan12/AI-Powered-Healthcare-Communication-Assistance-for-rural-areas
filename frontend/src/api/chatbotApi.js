// src/api/chatbotApi.js — matches app/api/v1/chatbot.py (Phase 1 backend merge)
import { apiClient } from "./client";

export const chatbotApi = {
  async listSessions() {
    const { data } = await apiClient.get("/chatbot/sessions");
    return data; // ChatSessionResponse[]
  },

  async createSession({ title, language = "en" } = {}) {
    const { data } = await apiClient.post("/chatbot/sessions", { title, language });
    return data;
  },

  async listMessages(sessionId) {
    const { data } = await apiClient.get(`/chatbot/sessions/${sessionId}/messages`);
    return data; // ChatMessageResponse[]
  },

  async deleteSession(sessionId) {
    const { data } = await apiClient.delete(`/chatbot/sessions/${sessionId}`);
    return data;
  },

  async ask({ question, sessionId, language = "en" }) {
    const { data } = await apiClient.post("/chatbot/ask", {
      question,
      session_id: sessionId ?? null,
      language,
    }, {
      // Groq -> Gemini fallback (+ translation) can legitimately take longer than the 30s default.
      timeout: 120000,
    });
    return data; // ChatAskResponse { session_id, user_message, assistant_message, sources }
  },

  /** audioBlob: a Blob/File recorded via MediaRecorder. language: 'auto' or a language code. */
  async askVoice({ audioBlob, sessionId, language = "auto", filename = "recording.webm" }) {
    const formData = new FormData();
    formData.append("audio", audioBlob, filename);
    if (sessionId) formData.append("session_id", sessionId);
    formData.append("language", language);

    const { data } = await apiClient.post("/chatbot/voice", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
    return data; // VoiceAskResponse
  },
};
