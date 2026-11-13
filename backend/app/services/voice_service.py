"""
app/services/voice_service.py — Speech-to-text, text-to-speech, language detection.

Merged from the standalone project's `src/speech_to_text_groq.py`,
`src/text_to_speech.py`, and `src/language_detector.py`. The original
`src/speech_to_text.py` (local `whisper` package, ~150MB-1.5GB model
download) was dropped in favor of the Groq-hosted Whisper API variant that
was already in the project, since it needs no local model download and
matches the "no local ML runtime" constraint used everywhere else in this
merge (OCR, NLP, chatbot LLM).

Stub behaviour: if GROQ_API_KEY / GEMINI_API_KEY are missing, or the
optional `groq` / `google-genai` / `langdetect` packages aren't installed,
each method returns a stub result instead of raising, consistent with the
rest of the chatbot module.
"""
from __future__ import annotations

import base64
import wave
from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class TranscriptionResult:
    text: str
    language: str
    is_stub: bool = False


@dataclass
class SpeechResult:
    audio_bytes: bytes | None
    is_stub: bool = False


class VoiceService:
    # -- Speech to text (Groq Whisper) ------------------------------------

    def speech_to_text(self, audio_path: str, language_hint: str | None = None) -> TranscriptionResult:
        if not settings.GROQ_API_KEY:
            return self._stt_stub("GROQ_API_KEY is not configured")

        try:
            from groq import Groq  # type: ignore
        except ImportError:
            return self._stt_stub("'groq' package is not installed")

        try:
            client = Groq(api_key=settings.GROQ_API_KEY)
            with open(audio_path, "rb") as audio_file:
                kwargs = {"file": audio_file, "model": "whisper-large-v3"}
                if language_hint and language_hint != "auto":
                    kwargs["language"] = language_hint
                transcription = client.audio.transcriptions.create(**kwargs)
            detected_language = getattr(transcription, "language", None) or language_hint or "en"
            return TranscriptionResult(text=transcription.text.strip(), language=detected_language)
        except Exception as exc:
            if not settings.CHATBOT_ALLOW_STUB_ENGINE:
                raise
            logger.error("Voice service: speech-to-text failed (%s); returning stub.", exc, exc_info=True)
            return self._stt_stub(str(exc))

    def _stt_stub(self, reason: str) -> TranscriptionResult:
        if not settings.CHATBOT_ALLOW_STUB_ENGINE:
            raise RuntimeError(f"Speech-to-text unavailable: {reason}")
        logger.warning("Voice service: speech-to-text unavailable (%s); returning stub.", reason)
        return TranscriptionResult(
            text="[Voice transcription is unavailable in demo mode. Please type your question instead.]",
            language="en",
            is_stub=True,
        )

    # -- Text to speech (Gemini) ------------------------------------------

    def text_to_speech(self, text: str, output_path: str) -> SpeechResult:
        if not settings.GEMINI_API_KEY:
            logger.warning("Voice service: text-to-speech unavailable (GEMINI_API_KEY not configured).")
            return SpeechResult(audio_bytes=None, is_stub=True)

        try:
            from google import genai  # type: ignore
            from google.genai import types  # type: ignore
        except ImportError:
            logger.warning("Voice service: text-to-speech unavailable ('google-genai' package not installed).")
            return SpeechResult(audio_bytes=None, is_stub=True)

        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_TTS_MODEL,
                contents=text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=settings.GEMINI_TTS_VOICE)
                        )
                    ),
                ),
            )
            pcm_data = response.candidates[0].content.parts[0].inline_data.data
            self._save_wave_file(output_path, pcm_data)
            return SpeechResult(audio_bytes=pcm_data)
        except Exception as exc:
            if not settings.CHATBOT_ALLOW_STUB_ENGINE:
                raise
            logger.error("Voice service: text-to-speech failed (%s); skipping audio reply.", exc, exc_info=True)
            return SpeechResult(audio_bytes=None, is_stub=True)

    @staticmethod
    def _save_wave_file(filename: str, pcm_data: bytes) -> None:
        Path(filename).parent.mkdir(parents=True, exist_ok=True)
        with wave.open(filename, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(pcm_data)

    # -- Language detection (langdetect, pure-python, always available) --

    def detect_language(self, text: str) -> str:
        try:
            from langdetect import detect  # type: ignore

            return detect(text)
        except ImportError:
            logger.warning("Voice service: 'langdetect' package not installed; defaulting to 'en'.")
            return "en"
        except Exception:
            return "en"


_voice_service: VoiceService | None = None


def get_voice_service() -> VoiceService:
    global _voice_service
    if _voice_service is None:
        _voice_service = VoiceService()
    return _voice_service
