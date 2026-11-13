"""
app/main.py — Unified FastAPI application entrypoint.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.chatbot import router as chatbot_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.languages import router as languages_router
from app.api.v1.medical_history import router as medical_history_router
from app.api.v1.ocr import router as ocr_router
from app.api.v1.profile import router as profile_router
from app.api.v1.simplify_translate import router as simplify_translate_router

# ⭐ NEW
from app.api.v1.prescription_summary import (
    router as prescription_summary_router,
)

from app.core.config import settings
from app.core.exception_handlers import register_exception_handlers
from app.core.logging_config import configure_logging
from app.database.session import close_db, init_db
from app.routers import contact, health

configure_logging(debug=settings.ENV != "production", log_dir=settings.LOG_DIR)
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("%s starting (env=%s)...", settings.APP_NAME, settings.ENV)
    init_db()
    logger.info("Database ready at %s", settings.DATABASE_URL)
    if settings.OCR_PRELOAD_ON_STARTUP:
        # Load OCR weights now, not inside the first upload request (which used to
        # download them mid-request and time out). A failure is logged loudly but
        # doesn't stop the API; uploads will then return the real reason.
        from app.services.ocr_service import get_ocr_service
        from app.utils.exceptions import MedicalAIError

        try:
            svc = get_ocr_service()
            logger.info("OCR engine ready: %s %s", svc.engine_name, svc.engine_version)
        except MedicalAIError as exc:
            logger.error("OCR engine NOT available at startup: %s", exc.message)
    yield
    logger.info("Shutting down %s...", settings.APP_NAME)
    close_db()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    description=(
        "Unified backend for the AI-Powered Healthcare Communication Assistant "
        "for Rural Communities."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

# Landing Page
app.include_router(health.router)
app.include_router(contact.router)

API_PREFIX = f"/api/{settings.API_VERSION}"

# Existing Routers
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(profile_router, prefix=API_PREFIX)
app.include_router(medical_history_router, prefix=API_PREFIX)
app.include_router(ocr_router, prefix=API_PREFIX)
app.include_router(simplify_translate_router, prefix=API_PREFIX)
app.include_router(languages_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)

# ⭐ NEW Prescription Summary Router
app.include_router(
    prescription_summary_router,
    prefix=API_PREFIX,
)

# ⭐ NEW Chatbot Router (merged from the standalone RAG chatbot project)
app.include_router(chatbot_router, prefix=API_PREFIX)


@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "status": "running",
        "docs": "/docs",
        "api_prefix": API_PREFIX,
    }