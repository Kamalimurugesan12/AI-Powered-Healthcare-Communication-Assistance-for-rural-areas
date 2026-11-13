"""
tests/fake_llm_server.py — a tiny local HTTP server that speaks the *wire
protocol* of Groq (OpenAI-compatible) and Gemini (generateContent), including
their real error payloads (retired model, bad key, rate limit).

It lets the tests drive the REAL `groq` and `google-genai` SDKs end to end
(request building, HTTP, SDK exception types) without internet access or API
keys. Point the SDKs at it with GROQ_BASE_URL / GOOGLE_GEMINI_BASE_URL.

Behaviour per model ID is configured via `FakeLLM.behaviour[model]`:
    "ok" | "decommissioned" | "not_found" | "auth" | "rate_limit" | "empty"
"""
from __future__ import annotations

import json
import re
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer


class FakeLLM:
    def __init__(self) -> None:
        self.behaviour: dict[str, str] = {}
        self.default = "ok"
        self.requests: list[dict] = []   # (provider, model, body) of every call received
        self._server: HTTPServer | None = None

    # -- lifecycle ---------------------------------------------------
    def start(self) -> str:
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):  # silence
                pass

            def _send(self, status: int, payload: dict):
                data = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self):
                if self.path.endswith("/models"):
                    if "openai" in self.path:
                        return self._send(200, {"object": "list", "data": [
                            {"id": m, "object": "model", "created": 0, "owned_by": "x"} for m in ("openai/gpt-oss-120b", "openai/gpt-oss-20b")]})
                    return self._send(200, {"models": [{"name": "models/gemini-3.6-flash", "supportedActions": ["generateContent"]}]})
                self._send(404, {"error": "nope"})

            def do_POST(self):
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")

                if "/chat/completions" in self.path:  # Groq / OpenAI protocol
                    model = body.get("model", "")
                    outer.requests.append({"provider": "groq", "model": model, "body": body})
                    mode = outer.behaviour.get(model, outer.default)
                    if mode == "decommissioned":
                        return self._send(400, {"error": {"message": f"The model `{model}` has been decommissioned and is no longer supported. Please refer to https://console.groq.com/docs/deprecations for a recommendation on which model to use instead.", "type": "invalid_request_error", "code": "model_decommissioned"}})
                    if mode == "not_found":
                        return self._send(404, {"error": {"message": f"The model `{model}` does not exist or you do not have access to it.", "type": "invalid_request_error", "code": "model_not_found"}})
                    if mode == "auth":
                        return self._send(401, {"error": {"message": "Invalid API Key", "type": "invalid_request_error", "code": "invalid_api_key"}})
                    if mode == "rate_limit":
                        return self._send(429, {"error": {"message": "Rate limit reached for model. Please try again later.", "type": "tokens", "code": "rate_limit_exceeded"}})
                    text = "" if mode == "empty" else f"GROQ[{model}] generated answer"
                    return self._send(200, {"id": "chatcmpl-1", "object": "chat.completion", "created": 0, "model": model,
                                            "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
                                            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}})

                m = re.search(r"/models/([^/:]+):generateContent", self.path)
                if m:  # Gemini protocol
                    model = m.group(1)
                    outer.requests.append({"provider": "gemini", "model": model, "body": body})
                    mode = outer.behaviour.get(model, outer.default)
                    if mode in ("decommissioned", "not_found"):
                        return self._send(404, {"error": {"code": 404, "message": f"models/{model} is not found for API version v1beta, or is not supported for generateContent.", "status": "NOT_FOUND"}})
                    if mode == "auth":
                        return self._send(400, {"error": {"code": 400, "message": "API key not valid. Please pass a valid API key.", "status": "INVALID_ARGUMENT", "details": [{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "API_KEY_INVALID"}]}})
                    if mode == "rate_limit":
                        return self._send(429, {"error": {"code": 429, "message": "Resource has been exhausted (e.g. check quota).", "status": "RESOURCE_EXHAUSTED"}})
                    text = f"GEMINI[{model}] generated answer"
                    parts = [] if mode == "empty" else [{"text": text}]
                    return self._send(200, {"candidates": [{"content": {"role": "model", "parts": parts}, "finishReason": "STOP", "index": 0}]})

                self._send(404, {"error": {"message": f"unhandled path {self.path}"}})

        self._server = HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self._server.serve_forever, daemon=True).start()
        return f"http://127.0.0.1:{self._server.server_port}"

    def stop(self) -> None:
        if self._server:
            self._server.shutdown()
