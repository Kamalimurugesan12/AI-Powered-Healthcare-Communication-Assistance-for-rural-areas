"""Chatbot API (RAG + voice, merged from the standalone chatbot project).

All routes require authentication and operate only on the current user's
own chat sessions, mirroring app/api/v1/medical_history.py.
"""
from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.chat import (
    ChatAskRequest,
    ChatAskResponse,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionResponse,
    VoiceAskResponse,
)
from app.services.chatbot_service import get_chatbot_service

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])


@router.get("/status", summary="Chatbot configuration + (optionally) a live test call to each AI provider")
def chatbot_status(live: bool = False, current_user: User = Depends(get_current_user)):
    """Secret-free diagnostics: are the keys loaded, which models are configured, is retrieval
    up. `?live=true` makes one tiny real request to Groq and to Gemini and reports the result."""
    from app.core.config import describe_environment, settings
    from app.services import llm_providers
    from app.services.chatbot_retrieval_service import get_chatbot_retrieval_service

    retrieval = get_chatbot_retrieval_service()
    if live and not retrieval._init_attempted:
        retrieval._ensure_initialized()
    body = {
        "environment": describe_environment(),
        "providers_configured": llm_providers.configured_providers(),
        "models": {
            "groq": llm_providers._PROVIDERS["groq"]["models"](),
            "gemini": llm_providers._PROVIDERS["gemini"]["models"](),
        },
        "stub_allowed": settings.CHATBOT_ALLOW_STUB_ENGINE,
        "retrieval": retrieval.status(),
    }
    if live:
        body["live_probe"] = {name: llm_providers.probe(name) for name in llm_providers.DEFAULT_ORDER}
    return body


@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: ChatSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = get_chatbot_service(db)
    return service.create_session(str(current_user.id), payload.title, payload.language)


@router.get("/sessions", response_model=List[ChatSessionResponse])
def list_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service = get_chatbot_service(db)
    return service.list_sessions(str(current_user.id))


@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
def list_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = get_chatbot_service(db)
    return service.list_messages(str(current_user.id), str(session_id))


@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
def delete_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = get_chatbot_service(db)
    service.delete_session(str(current_user.id), str(session_id))
    return {"success": True, "message": "Chat session deleted successfully."}


@router.post("/ask", response_model=ChatAskResponse)
def ask(
    payload: ChatAskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = get_chatbot_service(db)
    session, user_msg, assistant_msg, sources = service.ask(
        str(current_user.id), payload.question, str(payload.session_id) if payload.session_id else None, payload.language
    )
    return ChatAskResponse(
        session_id=session.id, user_message=user_msg, assistant_message=assistant_msg, sources=sources
    )


@router.post("/voice", response_model=VoiceAskResponse)
async def ask_voice(
    audio: UploadFile = File(..., description="Recorded question (wav/mp3/m4a/webm/ogg)"),
    session_id: uuid.UUID | None = Form(None),
    language: str = Form("auto", description="'auto' to detect from speech, or an explicit language code"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = get_chatbot_service(db)
    session, user_msg, assistant_msg, sources, detected_language, audio_reply_available = await service.ask_voice(
        str(current_user.id), audio, str(session_id) if session_id else None, language
    )
    return VoiceAskResponse(
        session_id=session.id,
        detected_language=detected_language,
        transcribed_text=user_msg.content,
        user_message=user_msg,
        assistant_message=assistant_msg,
        audio_reply_available=audio_reply_available,
        sources=sources,
    )
