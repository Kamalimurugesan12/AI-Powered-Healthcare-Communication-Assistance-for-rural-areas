"""
app/models/chat.py — Chatbot conversation history.

Merged in from the standalone RAG-chatbot project (originally a stateless
`/ask` endpoint with no persistence). ChatSession groups messages into a
conversation; ChatMessage stores each turn plus the metadata needed to
show "how we got this answer" in the UI (retrieval score, source language,
whether translation/voice was involved) without re-running the pipeline.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel, GUID


class ChatSession(BaseModel):
    __tablename__ = "chat_sessions"

    user_id: Mapped[str] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), default="New conversation", nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)

    user = relationship("User", backref="chat_sessions")
    messages = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at"
    )


class ChatMessage(BaseModel):
    __tablename__ = "chat_messages"

    session_id: Mapped[str] = mapped_column(
        GUID(), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Set only on assistant messages that answered a non-English question.
    original_language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    translated_from_english: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Retrieval/generation provenance, surfaced in the UI as "confidence".
    similarity_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    llm_provider: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # "groq" | "gemini" | "stub"
    is_stub_response: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Set when the message originated from a voice recording.
    input_via_voice: Mapped[bool] = mapped_column(default=False, nullable=False)

    session = relationship("ChatSession", back_populates="messages")
