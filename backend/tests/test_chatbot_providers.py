"""
tests/test_chatbot_providers.py — verifies the Groq -> Gemini chain with the REAL
`groq` / `google-genai` SDKs talking to a local fake server that returns the
providers' real wire formats and error payloads.

What is (and isn't) proven here: request building, SDK exception types, error
classification, model fallback, provider fallback, error surfacing and the
no-stub default. What is NOT proven: that *your* keys are valid or that the
models exist on *your* account today — run `python scripts/diagnose_ai.py` for that.
"""
from __future__ import annotations

import os

os.environ["DATABASE_URL"] = "sqlite:///./test_chatbot_providers.db"
os.environ["PINECONE_API_KEY"] = ""          # retrieval off: isolate the LLM chain
os.environ["CHATBOT_ALLOW_STUB_ENGINE"] = "False"
os.environ["OCR_PRELOAD_ON_STARTUP"] = "False"

import pytest
from fastapi.testclient import TestClient

from tests.fake_llm_server import FakeLLM
from app.core.config import settings
from app.main import app
from app.services import llm_providers

DB = "./test_chatbot_providers.db"
GROQ_PRIMARY, GROQ_FALLBACK = "llama-3.3-70b-versatile", "openai/gpt-oss-120b"
GEMINI_PRIMARY, GEMINI_FALLBACK = "gemini-2.0-flash", "gemini-3.6-flash"


@pytest.fixture(scope="module")
def fake():
    server = FakeLLM()
    base = server.start()
    os.environ["GROQ_BASE_URL"] = base
    os.environ["GOOGLE_GEMINI_BASE_URL"] = base
    yield server
    server.stop()


@pytest.fixture(autouse=True)
def _configure(fake, monkeypatch):
    fake.behaviour.clear()
    fake.default = "ok"
    fake.requests.clear()
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-groq-key")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setattr(settings, "GROQ_MODEL", GROQ_PRIMARY)
    monkeypatch.setattr(settings, "GROQ_FALLBACK_MODELS", GROQ_FALLBACK)
    monkeypatch.setattr(settings, "GEMINI_MODEL", GEMINI_PRIMARY)
    monkeypatch.setattr(settings, "GEMINI_FALLBACK_MODELS", GEMINI_FALLBACK)
    monkeypatch.setattr(settings, "CHATBOT_ALLOW_STUB_ENGINE", False)


MSG = [{"role": "user", "content": "hello"}]


def test_groq_answers_directly(fake):
    r = llm_providers.generate(MSG)
    assert r.provider == "groq" and r.model == GROQ_PRIMARY and r.text.startswith("GROQ[")
    assert [q["model"] for q in fake.requests] == [GROQ_PRIMARY]


def test_retired_groq_model_falls_back_to_next_groq_model(fake):
    fake.behaviour[GROQ_PRIMARY] = "decommissioned"      # exactly what the old default now returns
    r = llm_providers.generate(MSG)
    assert r.provider == "groq" and r.model == GROQ_FALLBACK
    assert r.failures and r.failures[0].kind == "model_unavailable" and "GROQ_MODEL" in r.failures[0].message


def test_invalid_groq_key_goes_straight_to_gemini_without_hammering_groq(fake):
    fake.behaviour[GROQ_PRIMARY] = "auth"
    fake.behaviour[GROQ_FALLBACK] = "auth"
    r = llm_providers.generate(MSG)
    assert r.provider == "gemini" and r.model == GEMINI_PRIMARY
    assert sum(1 for q in fake.requests if q["provider"] == "groq") == 1   # auth => don't try more groq models
    assert r.failures[0].kind == "auth"


def test_gemini_is_the_working_fallback_when_all_groq_models_are_retired(fake):
    fake.behaviour[GROQ_PRIMARY] = fake.behaviour[GROQ_FALLBACK] = "decommissioned"
    r = llm_providers.generate(MSG)
    assert r.provider == "gemini" and r.text.startswith("GEMINI[")


def test_retired_gemini_model_falls_back_to_current_gemini_model(fake):
    fake.behaviour[GROQ_PRIMARY] = fake.behaviour[GROQ_FALLBACK] = "rate_limit"
    fake.behaviour[GEMINI_PRIMARY] = "not_found"          # gemini-2.0-flash retired 2026-06-01
    r = llm_providers.generate(MSG)
    assert r.provider == "gemini" and r.model == GEMINI_FALLBACK
    kinds = [f.kind for f in r.failures]
    assert "rate_limit" in kinds and "model_unavailable" in kinds


def test_empty_response_is_not_treated_as_success(fake):
    fake.behaviour[GROQ_PRIMARY] = "empty"
    r = llm_providers.generate(MSG)
    assert r.model == GROQ_FALLBACK and r.failures[0].kind == "empty_response"


def test_all_providers_failing_raises_with_real_reasons(fake):
    fake.default = "auth"
    with pytest.raises(llm_providers.LLMUnavailableError) as exc:
        llm_providers.generate(MSG)
    text = str(exc.value)
    assert "groq" in text and "gemini" in text and "authentication failed" in text
    assert "test-groq-key" not in text and "test-gemini-key" not in text   # never leak keys


def test_no_keys_configured_reports_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    with pytest.raises(llm_providers.LLMUnavailableError) as exc:
        llm_providers.generate(MSG)
    assert all(f.kind == "not_configured" for f in exc.value.failures)


def test_list_models_uses_real_sdk(fake):
    assert "openai/gpt-oss-120b" in llm_providers.list_provider_models("groq")
    assert "gemini-3.6-flash" in llm_providers.list_provider_models("gemini")


# ---------------------------------------------------------------------------
# Through the HTTP API (auth -> /chatbot/ask -> DB -> response)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    if os.path.exists(DB):
        os.remove(DB)
    with TestClient(app) as c:
        yield c
    if os.path.exists(DB):
        os.remove(DB)


@pytest.fixture(scope="module")
def headers(client):
    client.post("/api/v1/auth/register", json={"email": "prov@example.com", "password": "StrongPass123!",
                                               "full_name": "Prov Tester", "phone_number": "9876543210"})
    r = client.post("/api/v1/auth/login", data={"username": "prov@example.com", "password": "StrongPass123!"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _ask(client, headers, q="What is hypertension?"):
    return client.post("/api/v1/chatbot/ask", json={"question": q, "language": "en"}, headers=headers)


def test_api_returns_real_llm_answer_not_stub(client, headers, fake):
    r = _ask(client, headers)
    assert r.status_code == 200, r.text
    msg = r.json()["assistant_message"]
    assert msg["llm_provider"] == "groq" and msg["is_stub_response"] is False
    assert msg["content"].startswith("GROQ[")


def test_api_uses_fallback_provider_end_to_end(client, headers, fake):
    fake.behaviour[GROQ_PRIMARY] = fake.behaviour[GROQ_FALLBACK] = "auth"
    msg = _ask(client, headers).json()["assistant_message"]
    assert msg["llm_provider"] == "gemini" and msg["content"].startswith("GEMINI[")


def test_api_reports_provider_outage_clearly_instead_of_stub(client, headers, fake):
    fake.default = "decommissioned"
    r = _ask(client, headers)
    assert r.status_code == 503
    body = r.json()
    assert body["detail"] == "LLMProviderError"
    assert "model rejected as retired" in body["error"] and "GROQ_MODEL" in body["error"]


def test_stub_only_appears_when_explicitly_enabled(client, headers, fake, monkeypatch):
    fake.default = "auth"
    monkeypatch.setattr(settings, "CHATBOT_ALLOW_STUB_ENGINE", True)
    msg = _ask(client, headers).json()["assistant_message"]
    assert msg["is_stub_response"] is True and msg["llm_provider"] == "stub"
    assert msg["content"].startswith("[STUB RESPONSE]")


def test_status_endpoint_is_secret_free(client, headers):
    r = client.get("/api/v1/chatbot/status?live=true", headers=headers)
    assert r.status_code == 200
    raw = r.text
    assert "test-groq-key" not in raw and "test-gemini-key" not in raw
    body = r.json()
    assert body["environment"]["keys"]["GROQ_API_KEY"]["configured"] is True
    assert body["live_probe"]["groq"]["ok"] is True
    assert body["live_probe"]["gemini"]["ok"] is True
