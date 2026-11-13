"""Pydantic schemas for the Chatbot API (sessions, messages, ask, voice)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

# Kept identical to translation_service.SUPPORTED_LANGUAGES so the chatbot's
# language selector always matches the one used for reports/UI translation.
_SUPPORTED_LANGUAGES = {"en", "ta", "kn", "te", "hi"}


class ChatSessionCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    language: str = "en"

    @field_validator("language")
    @classmethod
    def _validate_language(cls, v: str) -> str:
        if v not in _SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language '{v}'. Supported: {sorted(_SUPPORTED_LANGUAGES)}")
        return v


class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    title: str
    language: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    original_language: str
    translated_from_english: bool
    similarity_score: Optional[float] = None
    llm_provider: Optional[str] = None
    is_stub_response: bool
    input_via_voice: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatAskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[uuid.UUID] = None
    language: str = "en"

    @field_validator("language")
    @classmethod
    def _validate_language(cls, v: str) -> str:
        if v not in _SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language '{v}'. Supported: {sorted(_SUPPORTED_LANGUAGES)}")
        return v

    @field_validator("question")
    @classmethod
    def _strip_question(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("question must not be empty")
        return v


class ChatAskResponse(BaseModel):
    session_id: uuid.UUID
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
    sources: List[str] = Field(default_factory=list)


class VoiceAskResponse(BaseModel):
    session_id: uuid.UUID
    detected_language: str
    transcribed_text: str
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
    audio_reply_available: bool
    sources: List[str] = Field(default_factory=list)
