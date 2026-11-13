"""
app/services/chatbot_translation_service.py — Free-form translation for chatbot Q&A.

app/services/translation_service.py already exists and handles the fixed
vocabulary of *structured medical reports* (dictionary + protected-token
approach — see its module docstring). It's the right tool for reports, but
it can't translate an arbitrary, open-ended LLM answer it has never seen
before, so the chatbot needs a second, LLM-based translator for that case.

Merged from the standalone project's `src/translator.py` + `src/groq_translator.py`.
Same provider chain as chatbot_llm_service: Gemini first (translation quality
tends to be better), Groq fallback, and — if neither is configured — the
original text is returned unchanged with `translated=False` so the caller
can show a "translation unavailable" notice instead of silently serving the
wrong language.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings
from app.core.logging_config import get_logger
from app.services import llm_providers
from app.services.translation_service import SUPPORTED_LANGUAGES
from app.utils.exceptions import LLMProviderError

logger = get_logger(__name__)

_TO_ENGLISH_PROMPT = """You are an expert multilingual medical translator.
Translate the following {source_language} sentence into English.
Rules: translate literally, preserve medical meaning, do not explain or summarize.
Return ONLY the translated sentence.

Sentence:
{text}"""

_FROM_ENGLISH_PROMPT = """You are an expert multilingual medical translator.
Translate the following English healthcare answer into {target_language}.
Rules: preserve exact meaning, use simple language, keep headings and bullet points, do not summarize.
Return ONLY the translated answer.

Answer:
{text}"""


@dataclass
class TranslationResult:
    text: str
    translated: bool
    provider: str | None = None  # "gemini" | "groq" | None


class ChatbotTranslationService:
    def to_english(self, text: str, source_language_code: str) -> TranslationResult:
        if source_language_code == "en":
            return TranslationResult(text=text, translated=False)
        language_name = SUPPORTED_LANGUAGES.get(source_language_code, source_language_code)
        return self._translate(_TO_ENGLISH_PROMPT.format(source_language=language_name, text=text), text, required=True)

    def from_english(self, text: str, target_language_code: str) -> TranslationResult:
        if target_language_code == "en":
            return TranslationResult(text=text, translated=False)
        language_name = SUPPORTED_LANGUAGES.get(target_language_code, target_language_code)
        return self._translate(_FROM_ENGLISH_PROMPT.format(target_language=language_name, text=text), text, required=False)

    # -- internal ---------------------------------------------------------

    def _translate(self, prompt: str, original_text: str, *, required: bool) -> TranslationResult:
        try:
            result = llm_providers.generate(
                [{"role": "user", "content": prompt}], order=("gemini", "groq"), temperature=0, purpose="translate"
            )
            return TranslationResult(text=result.text, translated=True, provider=result.provider)
        except llm_providers.LLMUnavailableError as exc:
            if not required:
                # Translating the final answer back failed, but a real English answer exists:
                # return it (flagged translated=False) rather than failing the whole request.
                logger.warning("Translation back to the user's language failed; returning English. %s", exc)
                return TranslationResult(text=original_text, translated=False)
            if settings.CHATBOT_ALLOW_STUB_ENGINE:
                logger.error("Translation failed; passing text through (stub mode): %s", exc)
                return TranslationResult(text=original_text, translated=False)
            raise LLMProviderError(f"Could not translate your question. {exc}") from exc


_translation_service: ChatbotTranslationService | None = None


def get_chatbot_translation_service() -> ChatbotTranslationService:
    global _translation_service
    if _translation_service is None:
        _translation_service = ChatbotTranslationService()
    return _translation_service
