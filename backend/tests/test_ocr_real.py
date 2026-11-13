"""
tests/test_ocr_real.py — OCR verification with REAL text recognition (no stub).

Generates real documents (PNG, JPG, scanned PDF, text-layer PDF, mixed PDF) and
pushes them through the full HTTP stack: auth -> POST /api/v1/ocr/extract ->
OCRService -> NLP -> DB -> JSON response. Asserts that the actual document text
comes back and that the stub engine / placeholder text is never involved.

Needs at least one real engine installed (paddleocr+model weights, or
rapidocr-onnxruntime); otherwise the real-OCR tests are skipped, never faked.
"""
from __future__ import annotations

import glob
import os

os.environ["DATABASE_URL"] = "sqlite:///./test_ocr_real.db"
os.environ["OCR_PRELOAD_ON_STARTUP"] = "False"
os.environ["OCR_ALLOW_STUB_ENGINE"] = "False"

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont

from app.core.config import settings
from app.main import app
from app.services import ocr_service as ocr_mod
from app.services.ocr_service import OCRService
from app.utils.exceptions import OCREngineError
from app.utils.text_cleaner import clean_ocr_text

DB = "./test_ocr_real.db"
LINES = [
    "City General Hospital",
    "Dr. Anita Sharma, MD",
    "Diagnosis: Type 2 Diabetes Mellitus",
    "Tab Metformin 500 mg twice daily for 30 days",
    "Tab Amlodipine 5 mg once daily after food",
    "Follow up after 2 weeks",
]
EXPECTED_WORDS = ["Hospital", "Metformin", "Amlodipine", "Diabetes"]


def _font(size=34):
    paths = glob.glob("/usr/share/fonts/**/DejaVuSans.ttf", recursive=True) + glob.glob("C:/Windows/Fonts/arial.ttf")
    return ImageFont.truetype(paths[0], size) if paths else ImageFont.load_default()


def _doc_image() -> Image.Image:
    img = Image.new("RGB", (1200, 520), "white")
    d = ImageDraw.Draw(img)
    f = _font()
    for i, line in enumerate(LINES):
        d.text((40, 30 + i * 75), line, fill="black", font=f)
    return img


@pytest.fixture(scope="module")
def docs(tmp_path_factory):
    import pymupdf

    root = tmp_path_factory.mktemp("docs")
    img = _doc_image()
    paths = {"png": root / "rx.png", "jpg": root / "rx.jpg", "scanned_pdf": root / "scan.pdf",
             "text_pdf": root / "text.pdf", "mixed_pdf": root / "mixed.pdf"}
    img.save(paths["png"])
    img.save(paths["jpg"], quality=88)

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_image(pymupdf.Rect(20, 40, 575, 40 + 555 * 520 / 1200), filename=str(paths["png"]))
    doc.save(paths["scanned_pdf"]); doc.close()

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    for i, line in enumerate(LINES):
        page.insert_text((50, 80 + i * 28), line, fontsize=14)
    doc.save(paths["text_pdf"]); doc.close()

    doc = pymupdf.open()
    p1 = doc.new_page()
    for i, line in enumerate(LINES[:2]):
        p1.insert_text((50, 80 + i * 28), line, fontsize=14)
    p2 = doc.new_page(width=595, height=842)
    p2.insert_image(pymupdf.Rect(20, 40, 575, 335), filename=str(paths["png"]))
    doc.save(paths["mixed_pdf"]); doc.close()
    return paths


@pytest.fixture(scope="module")
def client():
    if os.path.exists(DB):
        os.remove(DB)
    OCRService._instance = None
    OCRService._last_init_error = None
    with TestClient(app) as c:
        yield c
    if os.path.exists(DB):
        os.remove(DB)


@pytest.fixture(scope="module")
def headers(client):
    client.post("/api/v1/auth/register", json={"email": "ocr@example.com", "password": "StrongPass123!",
                                               "full_name": "OCR Tester", "phone_number": "9876543210"})
    r = client.post("/api/v1/auth/login", data={"username": "ocr@example.com", "password": "StrongPass123!"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def real_engine(client, headers):
    try:
        svc = OCRService()
    except OCREngineError as exc:
        pytest.skip(f"no real OCR engine available in this environment: {exc}")
    assert not svc._stub_mode, "stub engine must never be active in these tests"
    return svc


def _upload(client, headers, path, mime):
    with open(path, "rb") as fh:
        return client.post("/api/v1/ocr/extract", files={"file": (os.path.basename(path), fh, mime)}, headers=headers)


@pytest.mark.parametrize("key,mime", [
    ("png", "image/png"), ("jpg", "image/jpeg"), ("scanned_pdf", "application/pdf"),
    ("text_pdf", "application/pdf"),
])
def test_upload_returns_real_extracted_text(client, headers, docs, real_engine, key, mime):
    r = _upload(client, headers, docs[key], mime)
    assert r.status_code == 201, r.text
    body = r.json()
    text = body["ocr_text"]
    missing = [w for w in EXPECTED_WORDS if w.lower() not in text.lower()]
    assert not missing, f"{key}: words missing from OCR text {missing!r}\n---\n{text}"
    assert "OCR_STUB" not in text and "stub" not in text.lower()
    assert body["ocr_confidence"] > 0.5


def test_mixed_pdf_ocrs_the_scanned_page_instead_of_dropping_it(client, headers, docs, real_engine):
    """Old logic averaged chars over the whole PDF: one text page made the scanned page vanish."""
    r = _upload(client, headers, docs["mixed_pdf"], "application/pdf")
    assert r.status_code == 201, r.text
    text = r.json()["ocr_text"]
    assert "Metformin" in text, text      # only exists on the scanned page 2


def test_blank_image_gives_clear_422_not_empty_report(client, headers, real_engine, tmp_path):
    p = tmp_path / "blank.png"
    Image.new("RGB", (800, 600), "white").save(p)
    r = _upload(client, headers, p, "image/png")
    assert r.status_code == 422, r.text
    assert "No readable text" in r.json()["error"] or "No text" in r.json()["error"]


def test_unsupported_type_is_415_not_generic_500(client, headers, tmp_path):
    p = tmp_path / "x.txt"
    p.write_text("hello")
    r = client.post("/api/v1/ocr/extract", files={"file": ("x.txt", p.read_bytes(), "text/plain")}, headers=headers)
    assert r.status_code == 415, r.text


def test_corrupt_image_is_400(client, headers, real_engine):
    r = client.post("/api/v1/ocr/extract", files={"file": ("bad.png", b"not really a png", "image/png")}, headers=headers)
    assert r.status_code == 400, r.text


# ---------------------------------------------------------------------------
# Engine-layer behaviour that doesn't need real weights
# ---------------------------------------------------------------------------

def test_paddle3_adapter_converts_predict_output(monkeypatch):
    """PaddleOCR 3.x returns dicts with rec_texts/rec_scores/rec_polys from .predict()."""
    class FakeResult(dict):
        pass

    class FakePaddle:
        def predict(self, image):
            return [FakeResult(rec_texts=["Tab Metformin 500 mg", "BD"], rec_scores=[0.98, 0.91],
                               rec_polys=[np.array([[0, 0], [100, 0], [100, 20], [0, 20]]),
                                          np.array([[0, 30], [40, 30], [40, 50], [0, 50]])])]

    eng = object.__new__(ocr_mod._PaddleEngine)
    eng.major, eng._engine = 3, FakePaddle()
    raw = eng.ocr(np.zeros((60, 120, 3), dtype=np.uint8))
    lines = OCRService._parse_and_order(raw)
    assert [l.text for l in lines] == ["Tab Metformin 500 mg", "BD"]
    assert lines[0].confidence == pytest.approx(0.98)


def test_engine_failure_is_reported_not_hidden(monkeypatch):
    def boom(language, gpu):
        raise ValueError("Unknown argument: show_log")

    monkeypatch.setattr(ocr_mod, "_ENGINE_FACTORIES", {"paddleocr": boom, "rapidocr": boom})
    monkeypatch.setattr(settings, "OCR_ALLOW_STUB_ENGINE", False)
    OCRService._instance = None
    OCRService._last_init_error = None
    with pytest.raises(OCREngineError) as exc:
        OCRService()
    assert "Unknown argument: show_log" in str(exc.value) and "paddleocr" in str(exc.value)
    OCRService._instance = None
    OCRService._last_init_error = None


def test_stub_only_when_explicitly_enabled(monkeypatch):
    def boom(language, gpu):
        raise RuntimeError("no weights")

    monkeypatch.setattr(ocr_mod, "_ENGINE_FACTORIES", {"paddleocr": boom, "rapidocr": boom})
    monkeypatch.setattr(settings, "OCR_ALLOW_STUB_ENGINE", True)
    OCRService._instance = None
    OCRService._last_init_error = None
    svc = OCRService()
    assert svc._stub_mode and svc.engine_name == "stub"
    OCRService._instance = None
    OCRService._last_init_error = None


def test_text_cleaner_keeps_indic_scripts_and_units():
    out = clean_ocr_text("Metformin 500 µg  ने दिन में दो बार लें — 38.5 °C  தினமும் இருமுறை")
    assert "नेदिन" not in out and "दिन में दो बार" in out
    assert "µg" in out and "°C" in out and "தினமும்" in out
