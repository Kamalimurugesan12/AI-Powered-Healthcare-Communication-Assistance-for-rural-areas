"""
app/core/config.py — Centralized application settings.

Everything the app needs from the environment (secrets, DB URL, CORS
origins, token lifetimes) is defined here as a single `settings`
object, loaded once from `.env`. This replaces the old file, which
only exposed three loose constants and had no SECRET_KEY / DATABASE_URL
at all (app/core/security.py already expected a `settings` object that
didn't exist -- that was a broken import before this fix).
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import dotenv_values
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/

# Absolute path to backend/.env. The old code used env_file=".env", which is
# resolved against the *current working directory*, so starting uvicorn from
# any folder other than backend/ (e.g. the project root, or an IDE run
# config) silently loaded NO .env at all -> every API key looked empty.
ENV_FILE = BASE_DIR / ".env"

# Secrets that must never be empty if they exist in .env (see _recover_empty_secrets).
_SECRET_FIELDS = ("GROQ_API_KEY", "GEMINI_API_KEY", "PINECONE_API_KEY")


class Settings(BaseSettings):
    # --- General ---
    APP_NAME: str = "Health Explained API"
    API_VERSION: str = "v1"
    ENV: str = "development"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # --- Frontend / CORS ---
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = ""  # comma-separated, e.g. "https://app.example.com,https://admin.example.com"

    # --- Database (single shared connection for every module) ---
    DATABASE_URL: str = "sqlite:///./health_explained.db"

    # --- Auth / JWT ---
    SECRET_KEY: str = "CHANGE_ME_ACCESS_SECRET_DO_NOT_USE_IN_PRODUCTION"
    REFRESH_SECRET_KEY: str = "CHANGE_ME_REFRESH_SECRET_DO_NOT_USE_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Google OAuth ---
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # --- Storage paths (OCR uploads, rendered PDF pages, persisted JSON) ---
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    OUTPUT_DIR: Path = BASE_DIR / "outputs"
    LOG_DIR: Path = BASE_DIR / "logs"
    MODELS_DIR: Path = BASE_DIR / "models"
    PADDLEOCR_MODEL_DIR: Path = MODELS_DIR / "PaddleOCR"
    BIOCLINICALBERT_MODEL_DIR: Path = MODELS_DIR / "BioClinicalBERT"
    TEMP_IMAGE_DIR: Path = UPLOAD_DIR / "pdf_pages"

    # --- Upload constraints ---
    ALLOWED_EXTENSIONS: list[str] = [".jpg", ".jpeg", ".png", ".pdf"]
    ALLOWED_MIME_TYPES: list[str] = ["image/jpeg", "image/png", "application/pdf"]
    MAX_FILE_SIZE_MB: int = 25
    MAX_PDF_PAGES: int = 30

    # --- PDF text-layer detection ---
    PDF_NATIVE_TEXT_MIN_CHARS_PER_PAGE: int = 20

    # --- PaddleOCR ---
    OCR_LANGUAGE: str = "en"
    OCR_USE_ANGLE_CLS: bool = True
    OCR_USE_GPU: bool = False
    OCR_DET_MODEL_DIR: str = ""
    OCR_REC_MODEL_DIR: str = ""
    OCR_CLS_MODEL_DIR: str = ""
    OCR_ENABLE_MKLDNN: bool = False
    OCR_CPU_THREADS: int = 4
    OCR_MIN_CONFIDENCE: float = 0.50
    OCR_MAX_WORKERS: int = 4
    # When PaddleOCR isn't installed (e.g. this dev/CI sandbox has no
    # internet access to download the multi-hundred-MB model weights),
    # OCRService transparently falls back to a stub engine so the rest
    # of the pipeline (DB storage, simplification, translation) stays
    # fully testable. Set to False to force a hard failure instead.
    OCR_ALLOW_STUB_ENGINE: bool = False  # was True: it hid every real OCR failure behind fake output
    # Engines tried in order. "paddleocr" = best accuracy (needs paddlepaddle + model
    # download on first use); "rapidocr" = ONNX build of the same PP-OCR models with the
    # weights bundled in the pip wheel (no download), used if PaddleOCR can't start.
    OCR_ENGINE_ORDER: str = "paddleocr,rapidocr"
    # Load the engine at server start (instead of on the first upload, which used
    # to download model weights inside the request and hit the frontend timeout).
    OCR_PRELOAD_ON_STARTUP: bool = True

    # --- PDF rendering ---
    PDF_RENDER_DPI: int = 300

    # --- Image preprocessing ---
    PREPROCESS_MAX_DIMENSION: int = 2400
    # PP-OCR does its own normalisation; non-local-means denoising blurs small
    # prescription text and costs seconds per page, so it is opt-in now.
    PREPROCESS_ENABLE_DESKEW: bool = False
    PREPROCESS_ENABLE_DENOISE: bool = False
    PREPROCESS_ENABLE_GRAYSCALE: bool = False
    PREPROCESS_ENABLE_THRESHOLD: bool = False

    # --- BioClinicalBERT / NLP ---
    NLP_MODEL_NAME: str = "emilyalsentzer/Bio_ClinicalBERT"
    NLP_AGGREGATION_STRATEGY: str = "simple"
    NLP_MAX_TOKEN_LENGTH: int = 512
    NLP_MAX_INPUT_CHARS: int = 4000
    NLP_DEVICE_OVERRIDE: str = ""

    # --- Pipeline behaviour ---
    REVIEW_CONFIDENCE_THRESHOLD: float = 0.70

    # --- Chatbot: LLM providers (merged from the standalone RAG chatbot project) ---
    # Answer generation tries GROQ_API_KEY first (cloud, no local daemon needed),
    # then GEMINI_API_KEY as a fallback. The original standalone project used a
    # local Ollama server as primary — that's not something a deployed backend
    # (or this sandbox) can assume is running, so Groq is the new primary and
    # Ollama support was dropped rather than silently failing on every request.
    # MODEL IDs: the old defaults (llama-3.3-70b-versatile on Groq, shut down 2026-08-16;
    # gemini-2.0-flash on Gemini, shut down 2026-06-01) are retired, so every call failed
    # with "model not found/decommissioned" even with a valid key. See
    # console.groq.com/docs/deprecations and ai.google.dev/gemini-api/docs/deprecations.
    # The *_FALLBACK_MODELS lists are tried automatically when the primary model is rejected.
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_FALLBACK_MODELS: str = "openai/gpt-oss-20b"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GEMINI_FALLBACK_MODELS: str = "gemini-2.5-flash,gemini-3.8-flash"
    LLM_TIMEOUT_SECONDS: float = 45.0
    GEMINI_TTS_MODEL: str = "gemini-2.5-flash-preview-tts"
    GEMINI_TTS_VOICE: str = "Kore"

    # --- Chatbot: retrieval (Pinecone vector DB over ingested healthcare docs) ---
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX: str = "infosys-healthcare-ai-assistant"
    PINECONE_NAMESPACE: str = "default"
    CHATBOT_EMBEDDING_MODEL: str = "BAAI/bge-m3"
    CHATBOT_TOP_K: int = 5

    # Same stub-fallback pattern as OCR_ALLOW_STUB_ENGINE above: when the
    # Pinecone/Groq/Gemini keys aren't configured (or the optional
    # `pinecone`, `groq`, `google-genai`, `sentence-transformers` packages
    # aren't installed), the chatbot degrades to a clearly-labelled stub
    # response instead of crashing every chat request. Set to False to force
    # a hard failure when a provider is unavailable.
    CHATBOT_ALLOW_STUB_ENGINE: bool = False  # was True: it hid provider failures behind a canned answer

    # --- Chatbot: voice (speech-to-text / text-to-speech) ---
    VOICE_MAX_AUDIO_MB: int = 15
    VOICE_ALLOWED_EXTENSIONS: list[str] = [".wav", ".mp3", ".m4a", ".webm", ".ogg"]

    model_config = SettingsConfigDict(env_file=str(ENV_FILE), env_file_encoding="utf-8-sig", extra="ignore")

    @field_validator(*_SECRET_FIELDS, mode="before")
    @classmethod
    def _clean_secret(cls, v):
        """Strip whitespace/quotes/BOM that creep in when keys are pasted on Windows
        (e.g. GROQ_API_KEY="gsk_..." or a trailing space/CR). Never logged."""
        if isinstance(v, str):
            v = v.strip().strip("\ufeff").strip().strip("'\"").strip()
        return v

    @model_validator(mode="after")
    def _recover_empty_secrets(self):
        """An *empty* OS-level variable (e.g. `$env:GROQ_API_KEY=""` left in the PowerShell
        session, or an empty Windows user variable) outranks .env in pydantic-settings and
        makes a perfectly good .env value look unset. If the OS value is empty but .env has
        a value, use the .env one."""
        file_values = _read_env_file()
        for name in _SECRET_FIELDS:
            if not getattr(self, name) and file_values.get(name):
                setattr(self, name, self._clean_secret(file_values[name]))
        return self

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.ENV.lower() == "production":
            default_access = "CHANGE_ME_ACCESS_SECRET_DO_NOT_USE_IN_PRODUCTION"
            default_refresh = "CHANGE_ME_REFRESH_SECRET_DO_NOT_USE_IN_PRODUCTION"
            if self.SECRET_KEY == default_access or self.REFRESH_SECRET_KEY == default_refresh:
                raise ValueError("Production requires non-default SECRET_KEY and REFRESH_SECRET_KEY.")
            if self.OCR_ALLOW_STUB_ENGINE:
                raise ValueError("Production requires OCR_ALLOW_STUB_ENGINE=False with a real OCR engine installed.")
            if self.CHATBOT_ALLOW_STUB_ENGINE:
                raise ValueError(
                    "Production requires CHATBOT_ALLOW_STUB_ENGINE=False with GROQ_API_KEY/GEMINI_API_KEY/"
                    "PINECONE_API_KEY configured."
                )
        return self
    def get_allowed_origins(self) -> list[str]:
        configured = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        defaults = [self.FRONTEND_URL, "http://127.0.0.1:5173", "http://localhost:5173"]
        for origin in defaults:
            if origin not in configured:
                configured.append(origin)
        return configured

    def ensure_directories(self) -> None:
        for directory in (
            self.UPLOAD_DIR,
            self.OUTPUT_DIR,
            self.LOG_DIR,
            self.TEMP_IMAGE_DIR,
        ):
            Path(directory).mkdir(parents=True, exist_ok=True)


def _read_env_file() -> dict:
    try:
        return {k: (v or "") for k, v in dotenv_values(ENV_FILE, encoding="utf-8-sig").items()}
    except Exception:  # noqa: BLE001
        return {}


def describe_environment() -> dict:
    """Secret-free description of where configuration came from (for /chatbot/status,
    scripts/diagnose_ai.py). Reports presence and length only, never values."""
    file_values = _read_env_file()
    keys = {}
    for name in _SECRET_FIELDS:
        value = getattr(settings, name)
        keys[name] = {
            "configured": bool(value),
            "length": len(value),
            "present_in_env_file": bool(file_values.get(name)),
            "process_env_is_empty_override": name in os.environ and not os.environ[name].strip(),
        }
    return {
        "env_file": str(ENV_FILE),
        "env_file_exists": ENV_FILE.exists(),
        "cwd": str(Path.cwd()),
        "keys": keys,
    }


settings = Settings()
settings.ensure_directories()

# --- Backward-compatible module-level names (old code imported these directly) ---
APP_NAME = settings.APP_NAME
API_VERSION = settings.API_VERSION
FRONTEND_URL = settings.FRONTEND_URL


def get_allowed_origins() -> list[str]:
    return settings.get_allowed_origins()

