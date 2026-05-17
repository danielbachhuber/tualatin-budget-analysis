#!/usr/bin/env python3
"""Extract text from each budget PDF in pdfs/ into extracted/raw/."""

import sys
from pathlib import Path

import pypdf

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "pdfs"
OUT_DIR = ROOT / "extracted" / "raw"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def extract(pdf_path: Path, out_path: Path) -> tuple[int, int]:
    reader = pypdf.PdfReader(str(pdf_path))
    pages = len(reader.pages)
    chunks: list[str] = []
    for i, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception as e:
            text = f"[extraction error on page {i + 1}: {e}]"
        chunks.append(f"\n\n===== PAGE {i + 1} =====\n\n{text}")
    out_path.write_text("".join(chunks), encoding="utf-8")
    return pages, out_path.stat().st_size


def main() -> int:
    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if not pdfs:
        print("No PDFs found in", PDF_DIR, file=sys.stderr)
        return 1
    for pdf in pdfs:
        out = OUT_DIR / (pdf.stem + ".txt")
        try:
            pages, size = extract(pdf, out)
            print(f"  {pdf.name:40s}  {pages:4d} pages  {size/1024:8.1f} KB text")
        except Exception as e:
            print(f"  {pdf.name:40s}  FAILED: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
