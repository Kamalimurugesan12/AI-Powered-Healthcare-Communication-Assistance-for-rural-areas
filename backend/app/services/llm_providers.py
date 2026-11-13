"""
app/services/llm_providers.py — Groq + Gemini clients with real error reporting.

Why this module exists
----------------------
The chatbot answer service and the chatbot translation service each had their
own copy-pasted ``_try_groq`` / ``_try_gemini`` helpers that did::

    except Exception as exc:
        logger.error(...)
        return None          # <- error swallowed

so a retired model ID, an invalid key, a rate limit or a network failure all
looked identical to "no key configured" and the caller fell through to the
canned stub answer. Here every failure is classified, logged with its real
reason (never the key), collected, and returned to the caller so it can be
surfaced to the API client.

Behaviour
---------
* Providers are tried in order (Groq, then Gemini).
* Within a provider, the configured model is tried first, then the
  ``*_FALLBACK_MODELS`` list — but only when the failure is model-specific
  (model retired / not found / not permitted / rate limited). An invalid key
  or a network outage is NOT retried with other models of the same provider.
* ``ProviderFailure`` records carry a short machine-readable ``kind`` plus a
  human-readable message with an actionable hint.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable, List, Optional, Sequence

from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Result / error types
# ---------------------------------------------------------------------------

@dataclass
class ProviderFailure:
    provider: str          # "groq" | "gemini"
    model: str | None
    kind: str              # not_configured | package_missing | auth | model_unavailable |
                           # rate_limit | network | bad_request | empty_response | unknown
    message: str           # human-readable, secret-free

    def __str__(self) -> str:
        model = f" [{self.model}]" if self.model else ""
        return f"{self.provider}{model}: {self.message}"


@dataclass
class ProviderResult:
    text: str
    provider: str
    model: str
    elapsed_seconds: float
    failures: List[ProviderFailure] = field(default_factory=list)  # earlier failures that were recovered from


class LLMUnavailableError(RuntimeError):
    """Every configured provider failed (or none is configured)."""

    def __init__(self, failures: Sequence[ProviderFailure]):
        self.failures = list(failures)
        detail = " | ".join(str(f) for f in self.failures) or "no provider configured"
        super().__init__(detail)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _split_models(primary: str, fallbacks: str) -> List[str]:
    models: List[str] = []
    for m in [primary] + [x.strip() for x in (fallbacks or "").split(",")]:
        m = (m or "").strip()
        if m and m not in models:
            models.append(m)
    return models


def _status_code(exc: Exception) -> Optional[int]:
    for attr in ("status_code", "code"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    response = getattr(exc, "response", None)
    value = getattr(response, "status_code", None)
    return value if isinstance(value, int) else None


def _classify(provider: str, exc: Exception) -> tuple[str, str]:
    """Map an SDK exception to (kind, actionable message). Never includes secrets."""
    status = _status_code(exc)
    text = str(exc)
    low = text.lower()
    name = type(exc).__name__

    if status in (401,) or "invalid api key" in low or "api key not valid" in low or "api_key_invalid" in low:
        key = "GROQ_API_KEY" if provider == "groq" else "GEMINI_API_KEY"
        return "auth", f"authentication failed (HTTP {status or 401}) — {key} is invalid, revoked or for a different service"
    if (
        status in (404,)
        or "model_not_found" in low
        or "decommissioned" in low
        or "no longer supported" in low
        or "is not found" in low
        or "not found for api version" in low
        or "does not exist" in low and "model" in low
        or "has been shut down" in low
        or "retired" in low
    ):
        var = "GROQ_MODEL" if provider == "groq" else "GEMINI_MODEL"
        return "model_unavailable", f"model rejected as retired/unknown (HTTP {status or 404}) — update {var}"
    if status == 403 or "permission" in low and "denied" in low:
        return "model_unavailable", f"access denied for this model/key (HTTP {status or 403}); {text[:160]}"
    if status == 429 or "rate limit" in low or "quota" in low or "resource_exhausted" in low:
        return "rate_limit", f"rate limit / quota exceeded (HTTP {status or 429}); try again later or check plan limits"
    if name in ("APIConnectionError", "APITimeoutError", "ConnectError", "ConnectTimeout", "ReadTimeout", "TimeoutError") \
            or "connection" in low or "timed out" in low or "name resolution" in low or "network" in low:
        return "network", f"network failure reaching the API ({name}: {text[:160]})"
    if status == 400:
        return "bad_request", f"request rejected (HTTP 400): {text[:200]}"
    return "unknown", f"{name}: {text[:200]}"


# ---------------------------------------------------------------------------
# Provider calls
# ---------------------------------------------------------------------------

def _call_groq(model: str, messages: list[dict], temperature: float) -> str:
    from groq import Groq  # type: ignore

    client = Groq(api_key=settings.GROQ_API_KEY, timeout=settings.LLM_TIMEOUT_SECONDS, max_retries=1)
    response = client.chat.completions.create(model=model, messages=messages, temperature=temperature)
    content = response.choices[0].message.content if response.choices else None
    return (content or "").strip()


def _call_gemini(model: str, messages: list[dict], temperature: float) -> str:
    from google import genai  # type: ignore
    from google.genai import types  # type: ignore

    system = "\n".join(m["content"] for m in messages if m["role"] == "system") or None
    contents = []
    for m in messages:
        if m["role"] == "system":
            continue
        role = "model" if m["role"] == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part(text=m["content"])]))

    client = genai.Client(
        api_key=settings.GEMINI_API_KEY,
        http_options=types.HttpOptions(timeout=int(settings.LLM_TIMEOUT_SECONDS * 1000)),
    )
    # Google advises leaving temperature at its default (1.0) on Gemini 3.x models;
    # lowering it can cause degraded/looping output there.
    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=None if model.startswith("gemini-3") else temperature,
    )
    response = client.models.generate_content(model=model, contents=contents, config=config)
    return (response.text or "").strip()  # .text is None when the answer was blocked/empty


_PROVIDERS: dict[str, dict] = {
    "groq": {
        "key": lambda: settings.GROQ_API_KEY,
        "env": "GROQ_API_KEY",
        "package": "groq",
        "models": lambda: _split_models(settings.GROQ_MODEL, settings.GROQ_FALLBACK_MODELS),
        "call": _call_groq,
    },
    "gemini": {
        "key": lambda: settings.GEMINI_API_KEY,
        "env": "GEMINI_API_KEY",
        "package": "google-genai",
        "models": lambda: _split_models(settings.GEMINI_MODEL, settings.GEMINI_FALLBACK_MODELS),
        "call": _call_gemini,
    },
}

DEFAULT_ORDER = ("groq", "gemini")


def configured_providers() -> List[str]:
    return [name for name, spec in _PROVIDERS.items() if spec["key"]()]


def generate(
    messages: list[dict],
    *,
    order: Sequence[str] = DEFAULT_ORDER,
    temperature: float = 0.2,
    purpose: str = "chat",
) -> ProviderResult:
    """Run `messages` through the provider chain.

    Returns the first successful ProviderResult (its ``failures`` lists anything
    that failed on the way). Raises LLMUnavailableError with every failure when
    nothing succeeds.
    """
    failures: List[ProviderFailure] = []

    for name in order:
        spec = _PROVIDERS[name]
        if not spec["key"]():
            failures.append(ProviderFailure(name, None, "not_configured",
                                            f"{spec['env']} is empty/not loaded (see GET /api/v1/chatbot/status)"))
            continue

        for model in spec["models"]():
            started = time.time()
            try:
                text = spec["call"](model, messages, temperature)
            except ImportError as exc:
                failures.append(ProviderFailure(name, model, "package_missing",
                                                f"python package '{spec['package']}' is not installed ({exc.name}); "
                                                f"run: pip install {spec['package']}"))
                logger.error("LLM[%s/%s] package missing: %s", purpose, name, exc)
                break  # no point trying other models of this provider
            except Exception as exc:  # noqa: BLE001 - classify every SDK failure
                kind, message = _classify(name, exc)
                failures.append(ProviderFailure(name, model, kind, message))
                logger.error("LLM[%s] %s model=%s failed: kind=%s %s", purpose, name, model, kind, message)
                if kind in ("auth", "network"):
                    break  # same key/network for every model: don't hammer
                continue  # model_unavailable / rate_limit / bad_request -> next model

            if not text:
                failures.append(ProviderFailure(name, model, "empty_response",
                                                "provider returned an empty response (possibly blocked by safety filters)"))
                logger.error("LLM[%s] %s model=%s returned an empty response", purpose, name, model)
                continue

            elapsed = time.time() - started
            if failures:
                logger.warning(
                    "LLM[%s] answered by %s model=%s in %.2fs after %d failure(s): %s",
                    purpose, name, model, elapsed, len(failures), "; ".join(str(f) for f in failures),
                )
                if any(f.kind == "model_unavailable" and f.provider == name for f in failures):
                    var = "GROQ_MODEL" if name == "groq" else "GEMINI_MODEL"
                    logger.warning("ACTION NEEDED: set %s=%s in backend/.env (the configured model is unavailable).", var, model)
            else:
                logger.info("LLM[%s] answered by %s model=%s in %.2fs", purpose, name, model, elapsed)
            return ProviderResult(text=text, provider=name, model=model, elapsed_seconds=elapsed, failures=failures)

    raise LLMUnavailableError(failures)


# ---------------------------------------------------------------------------
# Diagnostics (used by /chatbot/status and scripts/diagnose_ai.py)
# ---------------------------------------------------------------------------

def list_provider_models(name: str) -> List[str]:
    """Ask the provider which model IDs this key can use (live network call)."""
    if name == "groq":
        from groq import Groq  # type: ignore

        client = Groq(api_key=settings.GROQ_API_KEY, timeout=15, max_retries=0)
        return sorted(m.id for m in client.models.list().data)
    if name == "gemini":
        from google import genai  # type: ignore
        from google.genai import types  # type: ignore

        client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options=types.HttpOptions(timeout=15000))
        out = []
        for m in client.models.list():
            actions = getattr(m, "supported_actions", None) or []
            if not actions or "generateContent" in actions:
                out.append((m.name or "").replace("models/", ""))
        return sorted(out)
    raise ValueError(name)


def probe(name: str, ask: Callable[[str], str] | None = None) -> dict:
    """Live-test one provider with a tiny prompt. Returns a secret-free dict."""
    spec = _PROVIDERS[name]
    info: dict = {"provider": name, "key_configured": bool(spec["key"]()), "models_tried": []}
    if not info["key_configured"]:
        info["ok"] = False
        info["error"] = f"{spec['env']} is empty/not loaded"
        return info
    try:
        result = generate(
            [{"role": "user", "content": "Reply with exactly: OK"}],
            order=(name,), temperature=0, purpose="probe",
        )
        info.update(ok=True, model=result.model, latency_s=round(result.elapsed_seconds, 2),
                    reply_preview=result.text[:40],
                    recovered_from=[str(f) for f in result.failures])
    except LLMUnavailableError as exc:
        info.update(ok=False, error=str(exc), failures=[f.__dict__ for f in exc.failures])
    return info
