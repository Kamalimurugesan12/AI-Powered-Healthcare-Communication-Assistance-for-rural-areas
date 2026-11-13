"""
app/services/ocr_service.py — OCRService

Wraps PaddleOCR as a thread-safe singleton (model weights are hundreds
of MB and take seconds to load, so we load exactly once, at app
startup — see main.py's lifespan hook).

Public surface required by the spec:

    class OCRService:
        def extract_text(file_path) -> ...

`extract_text` accepts either a filesystem path (str/Path) or raw
bytes plus a file extension, and internally handles:
  - image decoding (jpg/png) sent straight to preprocessing + OCR
  - PDFs: a selectable-text check first (native PyMuPDF text layer is
    used directly, skipping OCR entirely when available); otherwise
    per-page rasterization to 300 DPI PNGs, cached on disk so the same
    PDF is never re-rendered mid-request
  - preprocessing (resize/denoise/deskew/grayscale/threshold) for
    accuracy
  - PaddleOCR inference with reading-order reconstruction, with pages
    preprocessed and OCR'd concurrently via a thread pool
  - confidence scoring per line and per page
  - per-stage timing (load, conversion, preprocessing, OCR) reported
    back to the caller for observability

GPU support: if OCR_USE_GPU is enabled but no compatible GPU/paddle-gpu
build is available, we log a warning and transparently fall back to
CPU rather than crashing the service.
"""
from __future__ import annotations

import importlib.metadata
import os
import platform
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Callable, Dict, List, Optional, Union

import cv2
import numpy as np

from app.core.config import settings
from app.schemas.ocr import PageOCRResult, TextLine
from app.utils.exceptions import NoTextDetectedError, OCREngineError
from app.utils.file_utils import (
    bytes_to_image,
    cleanup_pdf_page_cache,
    extract_pdf_page_info,
    load_png_as_bgr,
    pdf_cache_dir_for,
    render_pdf_pages_to_png,
)
from app.core.logging_config import get_logger

logger = get_logger(__name__)

# Every engine adapter exposes `.ocr(image_bgr) -> [[ [box, (text, confidence)], ... ]]`
# (the classic PaddleOCR 2.x shape that OCRService._parse_and_order consumes).


class _StubOCREngine:
    """Placeholder engine. ONLY used when OCR_ALLOW_STUB_ENGINE=True *and* every real
    engine failed to start. It never reads the document: it returns one fake line with
    confidence 0.01. It is off by default so it can no longer mask real failures."""

    name = "stub"
    version = "n/a"

    def ocr(self, image: "np.ndarray", cls: bool = True):
        height, width = image.shape[:2]
        box = [[0.0, 0.0], [float(width), 0.0], [float(width), float(height)], [0.0, float(height)]]
        placeholder = (
            "[OCR_STUB_ENGINE_ACTIVE: no real OCR engine could be started; "
            "no text was extracted from this document.]"
        )
        return [[[box, (placeholder, 0.01)]]]


def _pkg_version(dist: str) -> Optional[str]:
    try:
        return importlib.metadata.version(dist)
    except importlib.metadata.PackageNotFoundError:
        return None


def _gpu_is_available() -> bool:
    """Best-effort Paddle GPU detection; never raises."""
    try:
        import paddle  # type: ignore

        return bool(paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0)
    except Exception:  # noqa: BLE001
        return False


def _quad(box) -> list:
    return [[float(p[0]), float(p[1])] for p in box]


class _PaddleEngine:
    """Adapter over PaddleOCR 3.x (`.predict()`, dict results) and 2.x (`.ocr()`).

    The previous code passed PaddleOCR-2.x-only arguments (use_gpu, show_log,
    use_angle_cls, det/rec/cls_model_dir). PaddleOCR 3.x rejects those with
    "Unknown argument", the broad `except Exception` turned that into the stub engine,
    and the user only ever saw placeholder text.
    """

    name = "paddleocr"

    def __init__(self, language: str, use_gpu: bool):
        # Set before importing paddle: skip the slow connectivity probe and keep
        # oneDNN/PIR off (known CPU crash on several Windows paddlepaddle builds).
        os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
        os.environ.setdefault("FLAGS_use_mkldnn", "0")
        import paddle  # noqa: F401  (fails here with a clear ImportError if paddlepaddle is missing)
        from paddleocr import PaddleOCR

        self.version = _pkg_version("paddleocr") or "unknown"
        self.major = int(self.version.split(".")[0]) if self.version[:1].isdigit() else 3

        if self.major >= 3:
            kwargs: dict = dict(
                lang=language,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=settings.OCR_USE_ANGLE_CLS,
                device="gpu:0" if use_gpu else "cpu",
                enable_mkldnn=bool(settings.OCR_ENABLE_MKLDNN and not use_gpu),
                cpu_threads=settings.OCR_CPU_THREADS,
            )
            if settings.OCR_DET_MODEL_DIR:
                kwargs["text_detection_model_dir"] = settings.OCR_DET_MODEL_DIR
            if settings.OCR_REC_MODEL_DIR:
                kwargs["text_recognition_model_dir"] = settings.OCR_REC_MODEL_DIR
            if settings.OCR_CLS_MODEL_DIR:
                kwargs["textline_orientation_model_dir"] = settings.OCR_CLS_MODEL_DIR
        else:  # PaddleOCR 2.x
            kwargs = dict(
                use_angle_cls=settings.OCR_USE_ANGLE_CLS,
                lang=language,
                use_gpu=use_gpu,
                enable_mkldnn=bool(settings.OCR_ENABLE_MKLDNN and not use_gpu),
                cpu_threads=settings.OCR_CPU_THREADS,
                show_log=False,
            )
            if settings.OCR_DET_MODEL_DIR:
                kwargs["det_model_dir"] = settings.OCR_DET_MODEL_DIR
            if settings.OCR_REC_MODEL_DIR:
                kwargs["rec_model_dir"] = settings.OCR_REC_MODEL_DIR
            if settings.OCR_CLS_MODEL_DIR:
                kwargs["cls_model_dir"] = settings.OCR_CLS_MODEL_DIR

        # Downloads detection + recognition weights on first run (needs internet once).
        self._engine = PaddleOCR(**kwargs)

    def ocr(self, image: np.ndarray, cls: bool = True):
        if self.major < 3:
            return self._engine.ocr(image, cls=cls)

        entries = []
        for res in self._engine.predict(image):
            data = res if hasattr(res, "get") else getattr(res, "json", {})
            if "rec_texts" not in data and isinstance(data.get("res"), dict):
                data = data["res"]
            texts = list(data.get("rec_texts") or [])
            scores = list(data.get("rec_scores") or [])
            polys = data.get("rec_polys")
            if polys is None:
                polys = data.get("dt_polys")
            if polys is None:  # axis-aligned boxes only
                polys = [
                    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
                    for x0, y0, x1, y1 in (data.get("rec_boxes") if data.get("rec_boxes") is not None else [])
                ]
            for text, score, poly in zip(texts, scores, polys):
                entries.append([_quad(poly), (str(text), float(score))])
        return [entries]


class _RapidOCREngine:
    """RapidOCR: the PP-OCR models exported to ONNX, weights bundled inside the pip
    wheel — works offline and without paddlepaddle. Used if PaddleOCR can't start."""

    name = "rapidocr"

    def __init__(self, language: str, use_gpu: bool):
        from rapidocr_onnxruntime import RapidOCR

        self.version = _pkg_version("rapidocr-onnxruntime") or "unknown"
        self._engine = RapidOCR()

    def ocr(self, image: np.ndarray, cls: bool = True):
        result, _ = self._engine(image)
        entries = [[_quad(box), (str(text), float(score))] for box, text, score in (result or [])]
        return [entries]


_ENGINE_FACTORIES: Dict[str, Callable[[str, bool], object]] = {
    "paddleocr": lambda language, gpu: _PaddleEngine(language, gpu),
    "rapidocr": lambda language, gpu: _RapidOCREngine(language, gpu),
}


# ---------------------------------------------------------------------------
# Lightweight image preprocessing (resize / denoise / deskew)
# ---------------------------------------------------------------------------

def _resize_if_needed(image: np.ndarray, max_dimension: int) -> np.ndarray:
    height, width = image.shape[:2]
    longest_side = max(height, width)
    if longest_side <= max_dimension:
        return image
    scale = max_dimension / float(longest_side)
    new_size = (int(width * scale), int(height * scale))
    return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)


def _denoise(image: np.ndarray) -> np.ndarray:
    try:
        return cv2.fastNlMeansDenoisingColored(image, None, 7, 7, 7, 21)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Denoising failed, using original image: %s", exc)
        return image


def _estimate_skew_angle(gray: np.ndarray) -> float:
    inverted = cv2.bitwise_not(gray)
    thresh = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if coords.shape[0] < 20:
        return 0.0
    # np.where gives (row, col) = (y, x); OpenCV >= 4.5 reports minAreaRect angles in (0, 90].
    angle = cv2.minAreaRect(coords[:, ::-1].astype(np.float32))[-1]
    if angle > 45:
        angle -= 90
    return angle if abs(angle) <= 15 else 0.0


def _deskew(image: np.ndarray) -> np.ndarray:
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        angle = _estimate_skew_angle(gray)
        if abs(angle) < 0.3:
            return image
        (h, w) = image.shape[:2]
        matrix = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
        return cv2.warpAffine(
            image, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Deskew failed, using original image: %s", exc)
        return image


def _grayscale(image: np.ndarray) -> np.ndarray:
    """Convert to grayscale, then back to 3-channel BGR so downstream
    consumers (PaddleOCR's detector/classifier) get a consistent shape
    whether or not grayscale/threshold are enabled."""
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Grayscale conversion failed, using original image: %s", exc)
        return image


def _adaptive_threshold(image: np.ndarray) -> np.ndarray:
    """Binarize via adaptive thresholding. Off by default (see
    settings.PREPROCESS_ENABLE_THRESHOLD) because it can reduce
    PaddleOCR accuracy on low-contrast or shaded medical documents."""
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11
        )
        return cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Adaptive thresholding failed, using original image: %s", exc)
        return image


def preprocess_image(image: np.ndarray) -> np.ndarray:
    """Resize -> denoise -> deskew -> grayscale -> threshold pipeline.
    Defensive: any failing step falls back to the previous image
    rather than aborting the request. Denoise/deskew run on the color
    image (denoise needs 3 channels; deskew's angle estimate is more
    stable before binarization), grayscale/threshold run last since
    they're what actually gets handed to the OCR engine."""
    processed = _resize_if_needed(image, settings.PREPROCESS_MAX_DIMENSION)
    if settings.PREPROCESS_ENABLE_DENOISE:
        processed = _denoise(processed)
    if settings.PREPROCESS_ENABLE_DESKEW:
        processed = _deskew(processed)
    if settings.PREPROCESS_ENABLE_THRESHOLD:
        # Thresholding already implies/needs a grayscale pass.
        processed = _adaptive_threshold(processed)
    elif settings.PREPROCESS_ENABLE_GRAYSCALE:
        processed = _grayscale(processed)
    return processed


# ---------------------------------------------------------------------------
# OCRService
# ---------------------------------------------------------------------------

class OCRService:
    """
    Thread-safe singleton wrapper around the PaddleOCR engine.

    PaddleOCR's underlying predictor is not guaranteed thread-safe for
    concurrent .ocr() calls, so a lock serializes inference. For higher
    throughput under load, run multiple worker processes rather than
    relying on in-process threading for the OCR call itself.
    """

    _instance = None
    _init_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            with cls._init_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    _last_init_error: Optional[str] = None
    _last_init_failed_at: float = 0.0
    _FAILURE_BACKOFF_SECONDS = 30.0

    def __init__(self, language: str | None = None):
        if self._initialized:
            return

        # Don't re-run a multi-second (or model-downloading) init on every request
        # while the engine is known to be broken: re-raise the recorded reason.
        cls = type(self)
        if cls._last_init_error and time.time() - cls._last_init_failed_at < cls._FAILURE_BACKOFF_SECONDS:
            raise OCREngineError(cls._last_init_error)

        self.language = language or settings.OCR_LANGUAGE
        self._infer_lock = threading.Lock()
        self.gpu_active = False
        self._stub_mode = False
        self.engine_name = "none"
        self.engine_version = ""
        self.init_errors: List[str] = []
        try:
            self._engine = self._load_engine(self.language)
        except OCREngineError as exc:
            cls._last_init_error = exc.message
            cls._last_init_failed_at = time.time()
            raise
        cls._last_init_error = None
        self._initialized = True

    # -- engine lifecycle -----------------------------------------------

    def _load_engine(self, language: str):
        """Try each engine in OCR_ENGINE_ORDER; return the first that starts.

        Every failure is logged with its real exception and remembered in
        `self.init_errors` (surfaced by /ocr/status and scripts/diagnose_ocr.py). The
        stub is used only if OCR_ALLOW_STUB_ENGINE=True; otherwise OCREngineError is
        raised listing *why each engine failed*.
        """
        self.init_errors = []
        requested_gpu = settings.OCR_USE_GPU
        use_gpu = bool(requested_gpu and _gpu_is_available())
        if requested_gpu and not use_gpu:
            logger.warning("OCR_USE_GPU=True but no usable GPU/paddle-gpu build was found. Using CPU.")

        order = [n.strip().lower() for n in settings.OCR_ENGINE_ORDER.split(",") if n.strip()]
        for name in order:
            factory = _ENGINE_FACTORIES.get(name)
            if factory is None:
                self.init_errors.append(f"{name}: unknown engine name in OCR_ENGINE_ORDER")
                continue
            logger.info("Initialising OCR engine '%s' (language=%s, gpu=%s)...", name, language, use_gpu)
            started = time.time()
            try:
                engine = factory(language, use_gpu)
            except Exception as exc:  # noqa: BLE001 - report the REAL reason, then try the next engine
                reason = f"{name}: {type(exc).__name__}: {exc}"
                self.init_errors.append(reason[:600])
                logger.error("OCR engine '%s' failed to start: %s", name, exc, exc_info=True)
                continue

            self.gpu_active = use_gpu and name == "paddleocr"
            self.engine_name = name
            self.engine_version = getattr(engine, "version", "")
            logger.info("OCR engine '%s %s' ready in %.2fs", name, self.engine_version, time.time() - started)
            if self.init_errors:
                logger.warning(
                    "Primary OCR engine unavailable; running on fallback '%s'. Reasons: %s",
                    name, self.init_errors,
                )
            return engine

        if settings.OCR_ALLOW_STUB_ENGINE:
            logger.error(
                "NO REAL OCR ENGINE AVAILABLE -> using STUB because OCR_ALLOW_STUB_ENGINE=True. "
                "Documents will NOT be read. Reasons: %s", self.init_errors,
            )
            self.engine_name, self.engine_version, self._stub_mode = "stub", "n/a", True
            return _StubOCREngine()

        raise OCREngineError(
            "No OCR engine could be started. " + " | ".join(self.init_errors or ["OCR_ENGINE_ORDER is empty"])
            + " -- run `python scripts/diagnose_ocr.py` for details."
        )

    @classmethod
    def diagnostics(cls) -> dict:
        """Environment facts needed to debug OCR start-up (no secrets)."""
        return {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "machine": platform.machine(),
            "packages": {
                d: _pkg_version(d)
                for d in ("paddlepaddle", "paddleocr", "paddlex", "rapidocr-onnxruntime", "onnxruntime",
                          "opencv-python-headless", "PyMuPDF", "numpy")
            },
            "settings": {
                "OCR_ENGINE_ORDER": settings.OCR_ENGINE_ORDER,
                "OCR_ALLOW_STUB_ENGINE": settings.OCR_ALLOW_STUB_ENGINE,
                "OCR_LANGUAGE": settings.OCR_LANGUAGE,
                "OCR_USE_GPU": settings.OCR_USE_GPU,
            },
            "last_init_error": cls._last_init_error,
        }

    def status(self) -> dict:
        return {
            "engine": self.engine_name,
            "version": self.engine_version,
            "is_stub": self._stub_mode,
            "language": self.language,
            "gpu": self.gpu_active,
            "fallback_reasons": self.init_errors,
        }

    def switch_language(self, language: str) -> None:
        """Reload the engine for a different OCR language. Expensive —
        use for admin/config changes, not per-request."""
        with self._infer_lock:
            if language == self.language:
                return
            logger.info("Switching OCR language: %s -> %s", self.language, language)
            self._engine = self._load_engine(language)
            self.language = language

    # -- low-level inference ---------------------------------------------

    def _run_ocr(self, image: np.ndarray) -> List[TextLine]:
        if image is None or image.size == 0:
            raise OCREngineError("Received an empty image for OCR inference.")

        try:
            with self._infer_lock:
                raw_result = self._engine.ocr(image, cls=settings.OCR_USE_ANGLE_CLS)
        except Exception as exc:  # noqa: BLE001
            logger.error("PaddleOCR inference failed: %s", exc, exc_info=True)
            raise OCREngineError(f"OCR inference failed: {exc}") from exc

        lines = self._parse_and_order(raw_result)
        if not lines:
            raise NoTextDetectedError()
        return lines

    @staticmethod
    def _parse_and_order(raw_result) -> List[TextLine]:
        """
        PaddleOCR returns: [[ [box, (text, confidence)], ... ]] (one outer
        list per input image; we OCR one image at a time). Reading order
        is reconstructed by sorting boxes into rows (by y-center, with a
        tolerance) then by x-center within each row, approximating
        natural top-to-bottom, left-to-right reading order for
        prescriptions, lab reports, and similar documents.
        """
        if not raw_result or raw_result[0] is None:
            return []

        candidates = []
        for entry in raw_result[0]:
            box, (text, confidence) = entry
            text = str(text).strip()
            if not text:
                continue
            y_center = sum(p[1] for p in box) / 4.0
            x_center = sum(p[0] for p in box) / 4.0
            candidates.append(
                {
                    "text": text,
                    "confidence": float(confidence),
                    "box": [[float(p[0]), float(p[1])] for p in box],
                    "y_center": y_center,
                    "x_center": x_center,
                }
            )

        if not candidates:
            return []

        avg_height = sum(
            max(p[1] for p in c["box"]) - min(p[1] for p in c["box"]) for c in candidates
        ) / len(candidates)
        row_tolerance = max(avg_height * 0.6, 8.0)

        candidates.sort(key=lambda c: c["y_center"])

        rows: List[List[dict]] = []
        for cand in candidates:
            placed = False
            for row in rows:
                if abs(row[0]["y_center"] - cand["y_center"]) <= row_tolerance:
                    row.append(cand)
                    placed = True
                    break
            if not placed:
                rows.append([cand])

        rows.sort(key=lambda row: sum(c["y_center"] for c in row) / len(row))
        for row in rows:
            row.sort(key=lambda c: c["x_center"])

        ordered_lines: List[TextLine] = []
        order_index = 0
        for row in rows:
            for cand in row:
                ordered_lines.append(
                    TextLine(
                        text=cand["text"],
                        confidence=cand["confidence"],
                        bounding_box=cand["box"],
                        order_index=order_index,
                    )
                )
                order_index += 1
        return ordered_lines

    # -- per-page worker (runs inside the thread pool) --------------------

    def _process_page_image(self, idx: int, raw_image: np.ndarray) -> PageOCRResult:
        """Preprocess + OCR a single page image. Safe to call from
        multiple threads concurrently — the cv2 preprocessing steps
        release the GIL, and the OCR call itself is serialized via
        self._infer_lock."""
        image = preprocess_image(raw_image)

        try:
            lines = self._run_ocr(image)
        except NoTextDetectedError:
            logger.warning("No text detected on page %d", idx)
            return PageOCRResult(
                page=idx, text="", confidence=0.0, line_count=0, low_confidence=True, lines=[]
            )

        full_text = "\n".join(line.text for line in lines)
        avg_confidence = sum(line.confidence for line in lines) / len(lines)

        return PageOCRResult(
            page=idx,
            text=full_text,
            confidence=round(avg_confidence, 4),
            line_count=len(lines),
            low_confidence=avg_confidence < settings.OCR_MIN_CONFIDENCE,
            lines=lines,
        )

    def _process_page_path(self, idx: int, page_path: Path) -> PageOCRResult:
        raw_image = load_png_as_bgr(page_path)
        return self._process_page_image(idx, raw_image)

    @staticmethod
    def _native_text_page_result(idx: int, text: str) -> PageOCRResult:
        """Build a PageOCRResult straight from a PDF's own text layer —
        no OCR was run, so confidence is 1.0 and there's no bounding-box
        geometry to report."""
        text = text.strip()
        line_count = len([ln for ln in text.splitlines() if ln.strip()])
        return PageOCRResult(
            page=idx,
            text=text,
            confidence=1.0,
            line_count=line_count,
            low_confidence=False,
            lines=[],
        )

    # -- public API --------------------------------------------------------

    def extract_text(
        self,
        file_path: Union[str, Path, None] = None,
        *,
        file_bytes: bytes | None = None,
        file_extension: str | None = None,
        stage_timings: Optional[Dict[str, float]] = None,
    ) -> List[PageOCRResult]:
        """
        Extract OCR text from a document.

        Accepts EITHER:
          - file_path: a path to an already-saved image/PDF on disk, OR
          - file_bytes + file_extension: raw bytes plus the extension
            (e.g. ".pdf", ".png") for documents not yet written to disk.

        If `stage_timings` (a dict) is passed, it is populated in-place
        with wall-clock seconds for each stage this call performs
        (subset of: "loading", "native_text_extraction", "conversion",
        "preprocessing_and_ocr") for performance logging by the caller.

        Returns a list of PageOCRResult (length 1 for images, N for
        an N-page PDF), each with cleaned reading-order lines,
        per-line confidence, and a page-level average confidence.
        """
        timings: Dict[str, float] = stage_timings if stage_timings is not None else {}

        load_start = time.time()
        if file_path is not None:
            path = Path(file_path)
            file_extension = path.suffix.lower()
            file_bytes = path.read_bytes()
        elif file_bytes is None or file_extension is None:
            raise OCREngineError(
                "extract_text() requires either file_path or (file_bytes + file_extension)."
            )
        timings["loading"] = round(time.time() - load_start, 4)

        if file_extension != ".pdf":
            # Images go straight to preprocessing + OCR.
            raw_image = bytes_to_image(file_bytes)
            ocr_start = time.time()
            result = self._process_page_image(1, raw_image)
            timings["preprocessing_and_ocr"] = round(time.time() - ocr_start, 4)
            return [result]

        # ---- PDF: decide PER PAGE between the text layer and OCR ---------
        # (the old logic averaged characters over the whole file, so a PDF with one
        # typed page and one scanned page was treated as "digital" and the scanned
        # page vanished.)
        native_start = time.time()
        page_info = extract_pdf_page_info(file_bytes)
        timings["native_text_extraction"] = round(time.time() - native_start, 4)

        min_chars = settings.PDF_NATIVE_TEXT_MIN_CHARS_PER_PAGE
        results_by_index: Dict[int, PageOCRResult] = {}
        scan_pages: List[int] = []
        for idx, info in enumerate(page_info, start=1):
            chars = len(info["text"].strip())
            # A page that is mostly one big picture with only a stamp/footer of real text
            # ("Scanned by ...") is still a scan: OCR it.
            looks_scanned = info["image_coverage"] > 0.5 and chars < 200
            if chars >= min_chars and not looks_scanned:
                results_by_index[idx] = self._native_text_page_result(idx, info["text"])
            else:
                scan_pages.append(idx)

        timings["conversion"] = 0.0
        timings["preprocessing_and_ocr"] = 0.0
        if scan_pages:
            logger.info(
                "PDF: %d page(s) use the text layer, %d page(s) need OCR: %s",
                len(results_by_index), len(scan_pages), scan_pages,
            )
            cache_dir = pdf_cache_dir_for(file_bytes, settings.PDF_RENDER_DPI)
            conversion_start = time.time()
            try:
                page_paths = render_pdf_pages_to_png(
                    file_bytes, cache_dir, settings.PDF_RENDER_DPI, only_pages=scan_pages
                )
                timings["conversion"] = round(time.time() - conversion_start, 4)

                ocr_start = time.time()
                max_workers = max(1, min(settings.OCR_MAX_WORKERS, len(page_paths)))
                with ThreadPoolExecutor(max_workers=max_workers) as pool:
                    futures = {
                        pool.submit(self._process_page_path, idx, path): idx
                        for idx, path in zip(scan_pages, page_paths)
                    }
                    for future in futures:
                        results_by_index[futures[future]] = future.result()
                timings["preprocessing_and_ocr"] = round(time.time() - ocr_start, 4)
            finally:
                cleanup_pdf_page_cache(cache_dir)

            # If OCR found nothing on a page that still had a little real text, keep that text.
            for idx in scan_pages:
                if not results_by_index[idx].text.strip() and page_info[idx - 1]["text"].strip():
                    results_by_index[idx] = self._native_text_page_result(idx, page_info[idx - 1]["text"])

        return [results_by_index[idx] for idx in sorted(results_by_index)]


def get_ocr_service() -> OCRService:
    """FastAPI dependency-style accessor for the singleton OCR service."""
    return OCRService()

