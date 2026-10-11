"""Generate synthetic DOCX/PDF fixtures and an isolated E2E data directory."""

import os
import tempfile
from pathlib import Path
from docx import Document

os.environ["STUDIO_DATA_DIR"] = tempfile.mkdtemp(prefix="reshi-e2e-data-")
os.environ["AI_MODE"] = "disabled"
os.environ.pop("RESUME_DOCX", None)
os.environ.pop("RESUME_PDF", None)

from backend.importer import parse_docx
from backend.pdf_export import export_pdf

folder = Path("tmp/e2e").resolve()
folder.mkdir(parents=True, exist_ok=True)
document = Document()
for text, style in [
    ("Test Candidate", "Title"),
    ("QA Engineer | SDET", "Subtitle"),
    ("Bengaluru, India | +91 9999999999 | candidate@example.test", "Normal"),
    ("example.com", "Normal"),
    ("PROFESSIONAL SUMMARY", "Heading 1"),
    ("Built Selenium test frameworks. Developed Python APIs. Delivered 100+ regression tests.", "Normal"),
    ("SKILLS", "Heading 1"),
    ("Languages: Java, Python, JavaScript", "Normal"),
    ("Test automation: Selenium, TestNG", "Normal"),
    ("WORK EXPERIENCE", "Heading 1"),
    ("Example Company\tJan 2023 - Present", "Normal"),
    ("QA Engineer | Bengaluru", "Normal"),
    ("Built Selenium automation and 100+ regression tests.", "List Bullet"),
    ("Developed Python APIs with deterministic validation.", "List Bullet"),
    ("PROJECTS", "Heading 1"),
    ("Test Engine | Automation", "Heading 2"),
    ("Python, pytest", "Normal"),
    ("Built a Python test engine.", "List Bullet"),
    ("AWARDS AND HONORS", "Heading 1"),
    ("Test Hackathon Winner", "Normal"),
    ("CERTIFICATIONS", "Heading 1"),
    ("Test Credential", "Normal"),
    ("EDUCATION", "Heading 1"),
    ("Bachelor of Engineering", "Normal"),
    ("Example College", "Normal"),
    ("2019 - 2022", "Normal"),
]:
    document.add_paragraph(text, style)
document.save(folder / "import.docx")
resume, _ = parse_docx(folder / "import.docx")
export_pdf(resume, folder / "reference.pdf")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8001)
