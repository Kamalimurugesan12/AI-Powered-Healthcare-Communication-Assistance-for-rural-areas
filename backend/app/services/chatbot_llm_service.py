"""
app/services/chatbot_llm_service.py — Answer generation for the RAG chatbot.

Merged from the standalone project's `src/llm.py` + `src/llm_fallback.py`.
Provider chain: Groq (primary) -> Gemini (fallback) -> stub (last resort).
The original project used a local Ollama server as primary; that assumes a
GPU-capable machine running `ollama serve`, which isn't a safe assumption
for a deployed backend, so it was dropped in favor of Groq-first, matching
the fallback provider that was already wired up.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from app.core.config import settings
from app.core.logging_config import get_logger
from app.services import llm_providers
from app.utils.exceptions import LLMProviderError

logger = get_logger(__name__)

_SYSTEM_PROMPT = (
    "You are a careful, honest healthcare communication assistant for rural communities. "
    "You remember the earlier turns of the current conversation and resolve pronouns/follow-ups "
    "(e.g. 'it', 'that', 'the medicine you mentioned') using that history."
)

_PROMPT_TEMPLATE = """You are an AI-powered Healthcare Communication Assistant for rural communities.

Answer using the healthcare context below when it's relevant. If the context doesn't cover the
question, say so plainly and give general, safe, non-diagnostic guidance instead of refusing outright.

Rules:
1. Prefer the provided context over general knowledge when they overlap.
2. Do not guess or invent medical facts.
3. Explain in simple, easy-to-understand language.
4. Never mention document names, chunk IDs, or retrieval details.
5. Always recommend seeing a doctor for diagnosis or treatment decisions.
6. Use the conversation history to understand references like "it", "that", or "the same medicine" —
   resolve them to what was actually discussed before answering.

Conversation so far (oldest first):
{history}

Healthcare Context:
{context}

User Question:
{question}

Respond in this format:

Summary:
(2-3 sentence overview)

Details:
(clear explanation)

Important points:
- point 1
- point 2
"""

# Simple, fast greeting/small-talk responses that must NOT be routed through
# the RAG/medical pipeline (that pipeline would otherwise force irrelevant
# "Summary/Details/Important points" medical-sounding output onto "hi").
_GREETING_REPLIES = {
    "hi": "Hi there! I'm your healthcare assistant. Ask me about symptoms, medicines, your prescriptions, or general health topics whenever you're ready.",
    "hello": "Hello! How can I help with your health questions today?",
    "hey": "Hey! What would you like to know about your health, a prescription, or a medical topic?",
    "good morning": "Good morning! I hope you're doing well. What can I help you with today?",
    "good afternoon": "Good afternoon! What health question can I help you with?",
    "good evening": "Good evening! How can I assist you with your health today?",
    "how are you": "I'm doing well, thank you for asking! I'm here to help with any health questions you have.",
    "thanks": "You're welcome! Let me know if you have any other health questions.",
    "thank you": "You're welcome! Feel free to ask anything else about your health.",
    "bye": "Take care! Come back anytime you have a health question.",
    "goodbye": "Goodbye! Wishing you good health.",
    "ok": "Alright! Let me know if there's anything about your health I can help with.",
    "okay": "Alright! Let me know if there's anything about your health I can help with.",
}


def detect_greeting(text: str) -> Optional[str]:
    """Return a canned greeting reply if `text` is pure small talk, else None.

    Deliberately conservative: only fires on short messages that are (close
    to) exactly a known greeting, so a real medical question that happens to
    start with "hi" (e.g. "hi, I have a fever") is never short-circuited.
    """
    if not text:
        return None
    normalized = text.strip().lower().strip("!.?, ")
    if not normalized:
        return None
    if len(normalized.split()) > 4:
        return None
    if normalized in _GREETING_REPLIES:
        return _GREETING_REPLIES[normalized]
    return None


@dataclass
class ChatTurn:
    role: str  # "user" | "assistant"
    content: str

_STUB_ANSWER = (
    "[STUB RESPONSE] No AI provider answered, so this is a canned placeholder, not a real "
    "answer. See the backend log / GET /api/v1/chatbot/status for the exact provider error. "
    "For medical questions please consult a healthcare worker."
)


@dataclass
class LLMAnswer:
    text: str
    provider: str  # "groq" | "gemini" | "stub"
    is_stub: bool = False
    model: str | None = None


def _format_history(history: Optional[List[ChatTurn]]) -> str:
    if not history:
        return "(this is the first message in the conversation)"
    lines = []
    for turn in history:
        speaker = "Patient" if turn.role == "user" else "Assistant"
        lines.append(f"{speaker}: {turn.content}")
    return "\n".join(lines)


class ChatbotLLMService:
    def generate_answer(
        self, question: str, context: str, history: Optional[List[ChatTurn]] = None
    ) -> LLMAnswer:
        prompt = _PROMPT_TEMPLATE.format(
            context=context or "(no matching context found)",
            question=question,
            history=_format_history(history),
        )
        # Structured chat turns (in addition to the transcript inlined in `prompt`) so
        # the model can resolve references like "it" against the real history.
        messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
        for turn in (history or [])[-8:]:
            messages.append({"role": "user" if turn.role == "user" else "assistant", "content": turn.content})
        messages.append({"role": "user", "content": prompt})

        try:
            result = llm_providers.generate(messages, temperature=0.2, purpose="chat")
        except llm_providers.LLMUnavailableError as exc:
            # Real reasons (auth / retired model / rate limit / network / package missing)
            # were already logged per attempt by llm_providers; surface them to the caller.
            if settings.CHATBOT_ALLOW_STUB_ENGINE:
                logger.error("Chatbot LLM failed, returning STUB because CHATBOT_ALLOW_STUB_ENGINE=True: %s", exc)
                return LLMAnswer(text=_STUB_ANSWER, provider="stub", is_stub=True)
            raise LLMProviderError(f"The AI assistant is unavailable. {exc}") from exc

        return LLMAnswer(text=result.text, provider=result.provider, model=result.model)


_llm_service: ChatbotLLMService | None = None


def get_chatbot_llm_service() -> ChatbotLLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = ChatbotLLMService()
    return _llm_service
