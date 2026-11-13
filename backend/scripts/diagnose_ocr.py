"""
OCR diagnostics. Run from the backend folder:

    python scripts/diagnose_ocr.py                 # which engine loads (and why others failed)
    python scripts/diagnose_ocr.py path\to\scan.jpg [more files...]   # also extract real text

Exit code 0 only if a REAL engine (not the stub) produced text.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.ocr_service import OCRService  # noqa: E402
from app.utils.exceptions import MedicalAIError  # noqa: E402


def main(files: list[str]) -> int:
    import json

    try:
        svc = OCRService()
    except MedicalAIError as exc:
        print("OCR ENGINE FAILED TO START:\n ", exc.message)
        print(json.dumps(OCRService.diagnostics(), indent=2))
        return 1

    print("Engine in use :", svc.engine_name, "(STUB!)" if svc._stub_mode else "(real)")
    for err in svc.init_errors:
        print("Earlier engine failure:", err)
    ok = not svc._stub_mode
    for f in files:
        start = time.time()
        pages = svc.extract_text(f)
        print(f"\n=== {f}: {len(pages)} page(s) in {time.time() - start:.1f}s")
        for p in pages:
            print(f"--- page {p.page} (confidence {p.confidence}, {p.line_count} lines)\n{p.text}")
        ok = ok and any(p.text.strip() for p in pages)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
