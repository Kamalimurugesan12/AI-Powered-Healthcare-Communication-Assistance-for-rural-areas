"""
app/services/chatbot_service.py — Chatbot orchestration (Phase: Chatbot merge).

Wires together retrieval (chatbot_retrieval_service), answer generation
(chatbot_llm_service), translation (chatbot_translation_service), and voice
(voice_service) into the two flows the API exposes:

  ask(text)   : question -> [translate to en] -> retrieve -> generate -> [translate back]
  ask_voice() : audio -> transcribe -> same as ask() -> [synthesize speech]

Every turn is persisted as ChatMessage rows under a ChatSession, mirroring
ProfileService's "self.db, commit, refresh" pattern used elsewhere in this
backend, and reuses app.services.activity_service.log_activity so chatbot
usage shows up in the same dashboard/activity feed as OCR uploads etc.
"""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.chat import ChatMessage, ChatSession
from app.services.activity_service import log_activity
from app.services.chatbot_llm_service import ChatTurn, detect_greeting, get_chatbot_llm_service
from app.services.chatbot_retrieval_service import get_chatbot_retrieval_service
from app.services.chatbot_translation_service import get_chatbot_translation_service
from app.services.voice_service import get_voice_service
from app.utils.exceptions import ChatSessionNotFoundError, FileTooLargeError, InvalidAudioError

logger = get_logger(__name__)


class ChatbotService:
    def __init__(self, db: Session):
        self.db = db
        self.retrieval = get_chatbot_retrieval_service()
        self.llm = get_chatbot_llm_service()
        self.translation = get_chatbot_translation_service()
        self.voice = get_voice_service()

    # -- Sessions ----------------------------------------------------------

    def create_session(self, user_id: str, title: Optional[str], language: str) -> ChatSession:
        session = ChatSession(user_id=user_id, title=title or "New conversation", language=language)
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def list_sessions(self, user_id: str) -> List[ChatSession]:
        return (
            self.db.query(ChatSession)
            .filter(ChatSession.user_id == user_id)
            .order_by(ChatSession.updated_at.desc())
            .all()
        )

    def get_owned_session(self, user_id: str, session_id: str) -> ChatSession:
        session = self.db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if session is None or str(session.user_id) != str(user_id):
            raise ChatSessionNotFoundError()
        return session

    def list_messages(self, user_id: str, session_id: str) -> List[ChatMessage]:
        session = self.get_owned_session(user_id, session_id)
        return session.messages

    def delete_session(self, user_id: str, session_id: str) -> None:
        session = self.get_owned_session(user_id, session_id)
        self.db.delete(session)
        self.db.commit()

    def _get_or_create_session(self, user_id: str, session_id: Optional[str], language: str) -> ChatSession:
        if session_id:
            return self.get_owned_session(user_id, str(session_id))
        return self.create_session(user_id, title=None, language=language)

    # -- Ask (text) ----------------------------------------------------------

    def ask(
        self, user_id: str, question: str, session_id: Optional[str], language: str, *, input_via_voice: bool = False
    ) -> Tuple[ChatSession, ChatMessage, ChatMessage, List[str]]:
        session = self._get_or_create_session(user_id, session_id, language)

        # Snapshot the conversation *before* adding this turn, strictly scoped
        # to this session (which get_owned_session/_get_or_create_session has
        # already verified belongs to this user) — this is what gives the
        # chatbot memory of earlier turns without ever touching another
        # user's or another session's messages.
        prior_messages = list(session.messages)
        history = [ChatTurn(role=m.role, content=m.content) for m in prior_messages[-10:]]

        if session.title == "New conversation":
            session.title = question[:60] + ("..." if len(question) > 60 else "")

        user_msg = ChatMessage(
            session_id=session.id,
            role="user",
            content=question,
            original_language=language,
            input_via_voice=input_via_voice,
        )
        self.db.add(user_msg)

        # Greetings/small talk ("hi", "hello", "thanks", ...) get a natural,
        # instant reply instead of being forced through the medical RAG
        # pipeline, which otherwise produces an irrelevant "Summary/Details/
        # Important points" medical-sounding answer to "hi".
        greeting_reply = detect_greeting(question)
        if greeting_reply is not None:
            from_en = self.translation.from_english(greeting_reply, language)
            final_answer_text = from_en.text
            assistant_msg = ChatMessage(
                session_id=session.id,
                role="assistant",
                content=final_answer_text,
                original_language=language,
                translated_from_english=from_en.translated,
                similarity_score=None,
                llm_provider="greeting",
                is_stub_response=False,
            )
            self.db.add(assistant_msg)
            log_activity(self.db, user_id, "chatbot_ask", "Greeted the healthcare assistant.", commit=False)
            self.db.commit()
            self.db.refresh(session)
            self.db.refresh(user_msg)
            self.db.refresh(assistant_msg)
            return session, user_msg, assistant_msg, []

        # 1. Translate question to English for retrieval/generation, if needed.
        to_en = self.translation.to_english(question, language)
        english_question = to_en.text

        # 2. Retrieve context from the healthcare knowledge base.
        retrieval = self.retrieval.retrieve(english_question)

        # 3. Generate the answer in English, passing prior turns so
        #    follow-ups like "how can I prevent it?" resolve "it" against
        #    what was already discussed in *this* session.
        llm_answer = self.llm.generate_answer(english_question, retrieval.context, history=history)

        # 4. Translate the answer back to the requested language, if needed.
        from_en = self.translation.from_english(llm_answer.text, language)
        final_answer_text = from_en.text

        assistant_msg = ChatMessage(
            session_id=session.id,
            role="assistant",
            content=final_answer_text,
            original_language=language,
            translated_from_english=from_en.translated,
            similarity_score=retrieval.scores[0] if retrieval.scores else None,
            llm_provider=llm_answer.provider,
            is_stub_response=llm_answer.is_stub,
        )
        self.db.add(assistant_msg)

        log_activity(self.db, user_id, "chatbot_ask", "Asked the healthcare assistant a question.", commit=False)
        self.db.commit()
        self.db.refresh(session)
        self.db.refresh(user_msg)
        self.db.refresh(assistant_msg)

        return session, user_msg, assistant_msg, retrieval.sources

    # -- Ask (voice) ---------------------------------------------------------

    async def ask_voice(
        self, user_id: str, audio_file: UploadFile, session_id: Optional[str], language: str
    ) -> Tuple[ChatSession, ChatMessage, ChatMessage, List[str], str, bool]:
        suffix = Path(audio_file.filename or "audio.wav").suffix.lower() or ".wav"
        if suffix not in settings.VOICE_ALLOWED_EXTENSIONS:
            raise InvalidAudioError(
                f"Unsupported audio format '{suffix}'. Allowed: {settings.VOICE_ALLOWED_EXTENSIONS}"
            )

        contents = await audio_file.read()
        size_mb = len(contents) / (1024 * 1024)
        if size_mb > settings.VOICE_MAX_AUDIO_MB:
            raise FileTooLargeError(f"Audio file is {size_mb:.1f}MB; max allowed is {settings.VOICE_MAX_AUDIO_MB}MB.")

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        try:
            language_hint = None if language == "auto" else language
            transcription = self.voice.speech_to_text(tmp_path, language_hint=language_hint)
        finally:
            Path(tmp_path).unlink(missing_ok=True)

        detected_language = transcription.language if transcription.language in ("en", "ta", "kn", "te", "hi") else "en"

        session, user_msg, assistant_msg, sources = self.ask(
            user_id, transcription.text, session_id, detected_language, input_via_voice=True
        )

        # Best-effort spoken reply; failure here shouldn't fail the whole request.
        audio_reply_available = False
        if not transcription.is_stub and not assistant_msg.is_stub_response:
            reply_path = str(settings.OUTPUT_DIR / "chat_audio" / f"{assistant_msg.id}.wav")
            speech = self.voice.text_to_speech(assistant_msg.content, reply_path)
            audio_reply_available = speech.audio_bytes is not None

        return session, user_msg, assistant_msg, sources, detected_language, audio_reply_available


def get_chatbot_service(db: Session) -> ChatbotService:
    return ChatbotService(db)
