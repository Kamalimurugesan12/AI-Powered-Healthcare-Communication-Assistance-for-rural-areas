import { useEffect, useRef, useState } from "react";
import { Menu, Send } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ChatMessageBubble from "./components/ChatMessageBubble";
import ChatSessionList from "./components/ChatSessionList";
import VoiceRecorderButton from "./components/VoiceRecorderButton";
import { chatbotApi } from "@/api/chatbotApi";
import { extractErrorMessage } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

const LANGUAGE_CODES = ["en", "hi", "te", "kn", "ta"];

export default function Chatbot() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState(user?.preferred_language || "en");
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef(null);

  const SUGGESTED_PROMPTS = t("chatbot.suggestedPrompts", { returnObjects: true });

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function loadSessions() {
    setLoadingSessions(true);
    try {
      const data = await chatbotApi.listSessions();
      setSessions(data);
    } catch (err) {
      toast.error(extractErrorMessage(err, t("chatbot.loadSessionsError")));
    } finally {
      setLoadingSessions(false);
    }
  }

  async function selectSession(sessionId) {
    setActiveSessionId(sessionId);
    setSidebarOpen(false);
    try {
      const msgs = await chatbotApi.listMessages(sessionId);
      setMessages(msgs);
    } catch (err) {
      toast.error(extractErrorMessage(err, t("chatbot.loadMessagesError")));
    }
  }

  function startNewConversation() {
    setActiveSessionId(null);
    setMessages([]);
    setSidebarOpen(false);
  }

  async function deleteSession(sessionId) {
    try {
      await chatbotApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (sessionId === activeSessionId) startNewConversation();
    } catch (err) {
      toast.error(extractErrorMessage(err, t("chatbot.deleteSessionError")));
    }
  }

  async function sendQuestion(text) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    // Optimistically show the user's message immediately.
    setMessages((prev) => [
      ...prev,
      { id: `pending-${Date.now()}`, role: "user", content: trimmed, is_stub_response: false },
    ]);
    setQuestion("");

    try {
      const result = await chatbotApi.ask({ question: trimmed, sessionId: activeSessionId, language });
      setMessages((prev) => [...prev.filter((m) => !String(m.id).startsWith("pending-")), result.user_message, result.assistant_message]);

      if (!activeSessionId) {
        setActiveSessionId(result.session_id);
        loadSessions();
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, t("chatbot.askError")));
      setMessages((prev) => prev.filter((m) => !String(m.id).startsWith("pending-")));
    } finally {
      setSending(false);
    }
  }

  async function sendVoice(blob) {
    setSending(true);
    try {
      const result = await chatbotApi.askVoice({ audioBlob: blob, sessionId: activeSessionId, language: "auto" });
      setMessages((prev) => [...prev, result.user_message, result.assistant_message]);
      if (!activeSessionId) {
        setActiveSessionId(result.session_id);
        loadSessions();
      }
      if (result.detected_language) setLanguage(result.detected_language);
    } catch (err) {
      toast.error(extractErrorMessage(err, t("chatbot.voiceError")));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-background">
      {/* 4rem = height of the shared sticky top navbar in AppLayout */}
      <div className="flex h-[calc(100vh-4rem)]">
        <ChatSessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={selectSession}
          onNew={startNewConversation}
          onDelete={deleteSession}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <button className="md:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="font-display text-lg leading-tight">{t("chatbot.headerTitle")}</h1>
                <p className="text-xs text-muted-foreground">{t("chatbot.headerSubtitle")}</p>
              </div>
            </div>

            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_CODES.map((code) => (
                  <SelectItem key={code} value={code}>{t(`common.languages.${code}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
            {messages.length === 0 && !loadingSessions && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="max-w-sm text-muted-foreground">
                  {t("chatbot.emptyStatePrompt")}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendQuestion(prompt)}
                      className="rounded-full border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <ChatMessageBubble key={m.id} message={m} />
            ))}

            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(question);
            }}
            className="flex items-end gap-2 border-t bg-card p-3"
          >
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendQuestion(question);
                }
              }}
              placeholder={t("chatbot.inputPlaceholder")}
              className="min-h-[44px] max-h-32 flex-1 resize-none"
              disabled={sending}
            />
            <VoiceRecorderButton onRecordingComplete={sendVoice} disabled={sending} />
            <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={sending || !question.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
