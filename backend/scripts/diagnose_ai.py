"""
Live diagnostics for the chatbot's AI providers. Run from the backend folder:

    python scripts/diagnose_ai.py              # keys, models, live Groq + Gemini test calls
    python scripts/diagnose_ai.py --retrieval  # also load Pinecone + the embedding model (slow first time)

Never prints API keys. Exit code 0 only if at least one provider answered.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import describe_environment, settings  # noqa: E402
from app.services import llm_providers  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--retrieval", action="store_true", help="also test Pinecone + embedding model")
    args = ap.parse_args()

    env = describe_environment()
    print(f".env file : {env['env_file']}  (exists: {env['env_file_exists']})")
    for name, st in env["keys"].items():
        flag = "SET" if st["configured"] else "NOT SET"
        note = "  <-- an EMPTY OS environment variable is overriding .env" if st["process_env_is_empty_override"] else ""
        print(f"{name:17}: {flag} (length {st['length']}){note}")
    print(f"GROQ_MODEL        : {settings.GROQ_MODEL}   fallbacks: {settings.GROQ_FALLBACK_MODELS}")
    print(f"GEMINI_MODEL      : {settings.GEMINI_MODEL}   fallbacks: {settings.GEMINI_FALLBACK_MODELS}")
    print(f"Stub flags        : CHATBOT_ALLOW_STUB_ENGINE={settings.CHATBOT_ALLOW_STUB_ENGINE}\n")

    any_ok = False
    for provider in llm_providers.DEFAULT_ORDER:
        print(f"--- {provider} ---")
        try:
            models = llm_providers.list_provider_models(provider)
            print(f"models this key can use ({len(models)}): {', '.join(models[:25])}{' ...' if len(models) > 25 else ''}")
        except Exception as exc:  # noqa: BLE001
            print(f"could not list models: {type(exc).__name__}: {str(exc)[:200]}")
        result = llm_providers.probe(provider)
        if result.get("ok"):
            any_ok = True
            print(f"OK  model={result['model']}  latency={result['latency_s']}s  reply={result['reply_preview']!r}")
            for note in result.get("recovered_from", []):
                print(f"    note (recovered): {note}")
        else:
            print(f"FAILED: {result.get('error')}")
        print()

    if args.retrieval:
        from app.services.chatbot_retrieval_service import ChatbotRetrievalService

        print("--- retrieval (Pinecone + embedding model) ---")
        svc = ChatbotRetrievalService()
        svc._state = "loading"
        svc._initialize()
        print(svc.status())
        if svc.status()["state"] == "ready":
            r = svc.retrieve("What are the symptoms of diabetes?")
            print(f"test query -> {len(r.scores)} match(es), top score {r.scores[:1]}, context chars {len(r.context)}")

    print("RESULT:", "at least one provider is working" if any_ok else "NO provider answered — see errors above")
    return 0 if any_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
