"""
app/services/chatbot_retrieval_service.py — Vector retrieval for the RAG chatbot.

Merged from the standalone project's `src/query.py`. That script embedded
the query with a local `sentence-transformers` model (BAAI/bge-m3, ~2GB)
and searched a pre-ingested Pinecone index (`infosys-healthcare-ai-assistant`)
of healthcare documents.

Both the embedding model download and the Pinecone index are external
dependencies this environment can't provision (no internet access to the
HuggingFace model hub, no existing Pinecone index/API key). Rather than
hardcode a fake index, this service:

  1. Loads the embedding model + Pinecone client lazily, on first use.
  2. If `pinecone`/`sentence-transformers` aren't installed, or
     PINECONE_API_KEY isn't set, or the model/index can't be reached,
     it logs a clear warning once and returns "no context" so the LLM
     service knows to answer from general knowledge / return a stub.
  3. Once a real PINECONE_API_KEY is set and the packages are installed
     (`pip install pinecone sentence-transformers`), retrieval starts
     working automatically — no code changes needed.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import List

from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class RetrievalResult:
    context: str
    scores: List[float] = field(default_factory=list)
    sources: List[str] = field(default_factory=list)
    used_stub: bool = False
    retrieval_time_seconds: float = 0.0


class ChatbotRetrievalService:
    """Optional knowledge-base lookup. It is an *enhancement*: if it can't run, the chatbot
    still answers (from the LLM's general knowledge) and the reason is logged and exposed
    via status(); retrieval problems must never make chat fail."""

    def __init__(self) -> None:
        self._embedding_model = None
        self._index = None
        self._unavailable_reason: str | None = None
        self._init_attempted = False
        self._state = "not_loaded"  # not_loaded | loading | ready | disabled | failed
        self._dimension_info: dict = {}

    # -- lazy init ---------------------------------------------------

    def _initialize(self) -> bool:
        self._init_attempted = True
        self._dimension_info = {}

        if not settings.PINECONE_API_KEY:
            self._state, self._unavailable_reason = "disabled", "PINECONE_API_KEY is not configured"
            logger.warning("Chatbot retrieval disabled: %s. Answers will use the LLM's general knowledge only.", self._unavailable_reason)
            return False

        try:
            from pinecone import Pinecone  # type: ignore
            from sentence_transformers import SentenceTransformer  # type: ignore
        except ImportError as exc:
            self._state = "disabled"
            self._unavailable_reason = f"package '{exc.name}' is not installed (pip install pinecone sentence-transformers)"
            logger.warning("Chatbot retrieval disabled: %s.", self._unavailable_reason)
            return False

        try:
            logger.info("Loading embedding model %s (first run downloads ~2GB)...", settings.CHATBOT_EMBEDDING_MODEL)
            self._embedding_model = SentenceTransformer(settings.CHATBOT_EMBEDDING_MODEL)
            model_dim = int(self._embedding_model.get_sentence_embedding_dimension())
            pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            names = [i["name"] if isinstance(i, dict) else i.name for i in pc.list_indexes()]
            if settings.PINECONE_INDEX not in names:
                raise RuntimeError(
                    f"Pinecone index '{settings.PINECONE_INDEX}' does not exist for this API key (found: {names or 'none'})"
                )
            index_dim = int(pc.describe_index(settings.PINECONE_INDEX).dimension)
            self._dimension_info = {"embedding_model_dim": model_dim, "index_dim": index_dim}
            if model_dim != index_dim:
                raise RuntimeError(
                    f"embedding model '{settings.CHATBOT_EMBEDDING_MODEL}' produces {model_dim}-dim vectors but index "
                    f"'{settings.PINECONE_INDEX}' is {index_dim}-dim -- use the model the index was built with"
                )
            self._index = pc.Index(settings.PINECONE_INDEX)
        except Exception as exc:  # noqa: BLE001 - network error, bad key, missing index, dimension mismatch...
            self._state = "failed"
            self._unavailable_reason = f"{type(exc).__name__}: {str(exc)[:300]}"
            logger.error("Chatbot retrieval failed to initialise: %s", self._unavailable_reason)
            self._embedding_model = self._index = None
            return False

        self._state, self._unavailable_reason = "ready", None
        logger.info("Chatbot retrieval backend ready (Pinecone index=%s, namespace=%s).", settings.PINECONE_INDEX, settings.PINECONE_NAMESPACE)
        return True

    def _ensure_initialized(self) -> bool:
        if not self._init_attempted:
            self._initialize()
        return self._state == "ready"

    def status(self) -> dict:
        return {
            "state": self._state,
            "reason": self._unavailable_reason,
            "index": settings.PINECONE_INDEX,
            "namespace": settings.PINECONE_NAMESPACE,
            "embedding_model": settings.CHATBOT_EMBEDDING_MODEL,
            **self._dimension_info,
        }

    # -- public API ----------------------------------------------------

    def retrieve(self, question: str) -> RetrievalResult:
        start = time.time()

        if not self._ensure_initialized():
            return RetrievalResult(context="", used_stub=True, retrieval_time_seconds=time.time() - start)

        try:
            query_embedding = self._embedding_model.encode(question, normalize_embeddings=True).tolist()
            results = self._index.query(
                vector=query_embedding,
                top_k=settings.CHATBOT_TOP_K,
                namespace=settings.PINECONE_NAMESPACE,
                include_metadata=True,
            )
            matches = results.matches if hasattr(results, "matches") else results.get("matches", [])
        except Exception as exc:  # noqa: BLE001
            logger.error("Chatbot retrieval query failed (answering without context): %s", exc, exc_info=True)
            return RetrievalResult(context="", used_stub=True, retrieval_time_seconds=time.time() - start)

        if not matches:
            logger.warning(
                "Pinecone returned 0 matches for index=%s namespace=%s -- is the namespace right and the index populated?",
                settings.PINECONE_INDEX, settings.PINECONE_NAMESPACE,
            )

        contexts, scores, sources = [], [], []
        for match in matches:
            score = match.score if hasattr(match, "score") else match["score"]
            metadata = (match.metadata if hasattr(match, "metadata") else match.get("metadata")) or {}
            scores.append(score)
            sources.append(metadata.get("source", "Unknown source"))
            text = (
                metadata.get("contextualized_text")
                or metadata.get("raw_text")
                or metadata.get("text")
                or metadata.get("content")
                or ""
            )
            contexts.append(text)

        return RetrievalResult(
            context="\n\n".join(c for c in contexts if c),
            scores=scores,
            sources=sources,
            used_stub=False,
            retrieval_time_seconds=time.time() - start,
        )


_retrieval_service: ChatbotRetrievalService | None = None


def get_chatbot_retrieval_service() -> ChatbotRetrievalService:
    global _retrieval_service
    if _retrieval_service is None:
        _retrieval_service = ChatbotRetrievalService()
    return _retrieval_service
