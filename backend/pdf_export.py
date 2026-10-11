import re
from pathlib import Path

import fitz
from playwright.sync_api import sync_playwright

from .importer import normalize
from .models import Resume, content_units
from .rendering import render_resume


def validate_pdf(path: Path, resume: Resume) -> dict:
    errors: list[str] = []
    with fitz.open(path) as pdf:
        text = "\n".join(page.get_text() for page in pdf)
        normalized = normalize(text)
        missing = [
            {"source_id": key, "text": t}
            for key, t in content_units(resume, visible_only=True)
            if normalize(t) not in normalized
        ]
        if missing:
            errors.append(f"{len(missing)} content items are missing from extracted PDF text.")
        dimensions = []
        fonts = set()
        links = 0
        for index, page in enumerate(pdf):
            dimensions.append([round(page.rect.width, 2), round(page.rect.height, 2)])
            if abs(page.rect.width - 595.28) > 2 or abs(page.rect.height - 841.89) > 2:
                errors.append(f"Page {index + 1} is not A4.")
            if not page.get_text().strip():
                errors.append(f"Page {index + 1} is blank.")
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    for span in line["spans"]:
                        rect = fitz.Rect(span["bbox"])
                        if (
                            rect.x0 < -1
                            or rect.y0 < -1
                            or rect.x1 > page.rect.width + 1
                            or rect.y1 > page.rect.height + 1
                        ):
                            errors.append(f"Text extends outside page {index + 1}.")
                        if "\ufffd" in span["text"] or "\x00" in span["text"]:
                            errors.append(f"Missing or invalid glyph on page {index + 1}.")
                        fonts.add(span["font"])
            links += len(page.get_links())
        expected_links = sum(bool(c.url) for c in resume.contacts)
        if links < expected_links:
            errors.append("Some contact hyperlinks are missing from the PDF.")
        # Sequence verifies content order, not just occurrence.
        cursor = 0
        for _, unit in content_units(resume, visible_only=True):
            needle = normalize(unit)
            found = normalized.find(needle, cursor)
            if found < 0:
                errors.append("The PDF reading order differs from the approved content.")
                break
            cursor = found + len(needle)
        return {
            "valid": not errors,
            "pages": len(pdf),
            "dimensions": dimensions,
            "fonts": sorted(fonts),
            "links": links,
            "missing": missing,
            "errors": list(dict.fromkeys(errors)),
            "text_characters": len(text),
            "selectable_text": bool(text.strip()),
        }


def export_pdf(resume: Resume, path: Path) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(".pending.pdf")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(java_script_enabled=False)
            page = context.new_page()
            page.set_content(render_resume(resume), wait_until="load")
            page.evaluate("document.fonts.ready")
            page.emulate_media(media="print")
            page.pdf(
                path=str(partial),
                format="A4",
                print_background=True,
                prefer_css_page_size=True,
                display_header_footer=False,
            )
            browser.close()
        validation = validate_pdf(partial, resume)
        if not validation["valid"]:
            raise ValueError("PDF validation failed: " + "; ".join(validation["errors"]))
        partial.replace(path)
        return validation
    finally:
        if partial.exists():
            partial.unlink()


def filename(name: str) -> str:
    return (re.sub(r"[^a-zA-Z0-9_-]+", "_", name).strip("_") or "Resume")[:100] + ".pdf"
