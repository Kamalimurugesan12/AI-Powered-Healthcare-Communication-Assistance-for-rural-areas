"""
tests/test_chatbot.py — Chatbot module tests (sessions, ask, voice) running
in stub mode (no GROQ/GEMINI/PINECONE keys needed). Uses its own SQLite
file so it never touches health_explained.db.
"""
from __future__ import annotations

import io
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_chatbot.db")
# This module deliberately exercises the explicit, opt-in stub mode (no provider keys needed).
os.environ["CHATBOT_ALLOW_STUB_ENGINE"] = "True"
os.environ["GROQ_API_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""
os.environ["PINECONE_API_KEY"] = ""
os.environ["OCR_PRELOAD_ON_STARTUP"] = "False"

import pytest
from fastapi.testclient import TestClient

from app.main import app

TEST_DB_PATH = "./test_chatbot.db"


@pytest.fixture(scope="module")
def client():
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    with TestClient(app) as c:
        yield c
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)


@pytest.fixture(scope="module")
def auth_headers(client: TestClient):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "chatbot-tests@example.com",
            "password": "StrongPass123!",
            "full_name": "Chatbot Tester",
            "phone_number": "9876543210",
        },
    )
    r = client.post(
        "/api/v1/auth/login",
        data={"username": "chatbot-tests@example.com", "password": "StrongPass123!"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_ask_creates_session_and_returns_stub_answer(client: TestClient, auth_headers):
    r = client.post(
        "/api/v1/chatbot/ask",
        json={"question": "What is antenatal care?", "language": "en"},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["session_id"]
    assert body["user_message"]["content"] == "What is antenatal care?"
    assert body["assistant_message"]["role"] == "assistant"
    # No GROQ/GEMINI keys configured in this test environment -> stub mode.
    assert body["assistant_message"]["is_stub_response"] is True
    assert body["assistant_message"]["llm_provider"] == "stub"


def test_ask_reuses_existing_session(client: TestClient, auth_headers):
    r1 = client.post("/api/v1/chatbot/ask", json={"question": "First question", "language": "en"}, headers=auth_headers)
    session_id = r1.json()["session_id"]

    r2 = client.post(
        "/api/v1/chatbot/ask",
        json={"question": "Follow-up question", "session_id": session_id, "language": "en"},
        headers=auth_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["session_id"] == session_id

    r3 = client.get(f"/api/v1/chatbot/sessions/{session_id}/messages", headers=auth_headers)
    assert r3.status_code == 200
    messages = r3.json()
    assert len(messages) == 4  # 2 user + 2 assistant turns
    assert [m["content"] for m in messages if m["role"] == "user"] == ["First question", "Follow-up question"]


def test_ask_in_non_english_language_falls_back_gracefully(client: TestClient, auth_headers):
    r = client.post(
        "/api/v1/chatbot/ask",
        json={"question": "இது ஒரு சோதனை கேள்வி", "language": "ta"},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user_message"]["original_language"] == "ta"
    # No translation provider configured -> text passes through unchanged, not translated.
    assert body["assistant_message"]["translated_from_english"] is False


def test_ask_rejects_unsupported_language(client: TestClient, auth_headers):
    r = client.post("/api/v1/chatbot/ask", json={"question": "hello", "language": "fr"}, headers=auth_headers)
    assert r.status_code == 422


def test_ask_requires_authentication(client: TestClient):
    r = client.post("/api/v1/chatbot/ask", json={"question": "hello", "language": "en"})
    assert r.status_code == 401


def test_list_and_delete_sessions(client: TestClient, auth_headers):
    r = client.post("/api/v1/chatbot/sessions", json={"language": "en"}, headers=auth_headers)
    assert r.status_code == 201
    session_id = r.json()["id"]

    r = client.get("/api/v1/chatbot/sessions", headers=auth_headers)
    assert r.status_code == 200
    assert any(s["id"] == session_id for s in r.json())

    r = client.delete(f"/api/v1/chatbot/sessions/{session_id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["success"] is True

    r = client.get(f"/api/v1/chatbot/sessions/{session_id}/messages", headers=auth_headers)
    assert r.status_code == 404


def test_cannot_access_another_users_session(client: TestClient, auth_headers):
    # Second user
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "other-user@example.com",
            "password": "StrongPass123!",
            "full_name": "Other User",
            "phone_number": "9876500000",
        },
    )
    r = client.post("/api/v1/auth/login", data={"username": "other-user@example.com", "password": "StrongPass123!"})
    other_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

    r = client.post("/api/v1/chatbot/sessions", json={"language": "en"}, headers=auth_headers)
    session_id = r.json()["id"]

    r = client.get(f"/api/v1/chatbot/sessions/{session_id}/messages", headers=other_headers)
    assert r.status_code == 404


def test_voice_ask_falls_back_to_text_prompt_stub(client: TestClient, auth_headers):
    # No GROQ_API_KEY configured -> speech-to-text runs in stub mode and
    # returns a clear "please type instead" message rather than erroring.
    fake_audio = io.BytesIO(b"RIFF....WAVEfmt ")
    r = client.post(
        "/api/v1/chatbot/voice",
        files={"audio": ("test.wav", fake_audio, "audio/wav")},
        data={"language": "en"},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["audio_reply_available"] is False
    assert "unavailable" in body["transcribed_text"].lower()


def test_voice_ask_rejects_unsupported_file_type(client: TestClient, auth_headers):
    fake_file = io.BytesIO(b"not audio")
    r = client.post(
        "/api/v1/chatbot/voice",
        files={"audio": ("test.txt", fake_file, "text/plain")},
        data={"language": "en"},
        headers=auth_headers,
    )
    assert r.status_code == 400
