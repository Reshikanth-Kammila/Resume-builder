"""DOCX is canonical; PDF is a comparison source. Never invent missing content."""

import re
import unicodedata
from pathlib import Path
from zipfile import ZipFile

import fitz
from docx import Document

from .models import Bullet, Contact, Entry, Evidence, Resume, Section, content_units

HEADINGS = {
    "professional summary": "summary",
    "summary": "summary",
    "skills": "skills",
    "work experience": "experience",
    "experience": "experience",
    "projects": "projects",
    "awards and honors": "awards",
    "awards & honors": "awards",
    "certifications": "certifications",
    "education": "education",
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).replace("\ufffd", " ")
    return re.sub(r"[^\w%+@.]+", " ", text.lower()).strip()


def clean_bullet(text: str) -> str:
    return re.sub(r"^[\s\ufffd•●▪\-]+", "", text).strip()


def contact(text: str) -> Contact:
    text = text.strip()
    if "@" in text:
        url = "mailto:" + text
    elif re.match(r"^\+?[\d\s()\-]{8,}$", text):
        url = "tel:" + re.sub(r"[^+\d]", "", text)
    elif re.match(r"^(https?://|www\.|[\w-]+\.(com|dev|io|in|org)(/|$))", text):
        url = text if text.startswith("http") else "https://" + text
    else:
        url = ""
    return Contact(label=text, url=url)


def parse_docx(path: Path, pdf_path: Path | None = None) -> tuple[Resume, dict]:
    with ZipFile(path) as archive:
        if sum(item.file_size for item in archive.infolist()) > 60_000_000:
            raise ValueError("DOCX exceeds the uncompressed import limit.")
    document = Document(path)
    # Read paragraphs and table cells in XML order, including hyperlink text.
    paragraphs: list[tuple[str, str]] = []
    from docx.oxml.ns import qn
    from docx.text.paragraph import Paragraph

    for child in document.element.body:
        elements = [child] if child.tag == qn("w:p") else child.iter(qn("w:p"))
        for element in elements:
            p = Paragraph(element, document)
            if p.text.strip():
                paragraphs.append((p.text.strip(), p.style.name))
    if len(paragraphs) < 3:
        raise ValueError("The DOCX has too little readable content to import.")
    resume = Resume(name=paragraphs[0][0])
    groups: dict[str, list[tuple[str, str]]] = {}
    preamble: list[str] = []
    current = None
    for text, style in paragraphs[1:]:
        kind = HEADINGS.get(text.lower())
        if kind:
            current = kind
            groups.setdefault(kind, [])
        elif current:
            groups[current].append((text, style))
        else:
            preamble.append(text)
    if preamble:
        resume.headline = preamble.pop(0)
        resume.contacts = [contact(part) for line in preamble for part in line.split("|") if part.strip()]
    for title, kind in [
        ("Professional Summary", "summary"),
        ("Skills", "skills"),
        ("Work Experience", "experience"),
        ("Projects", "projects"),
        ("Awards and Honors", "awards"),
        ("Certifications", "certifications"),
        ("Education", "education"),
    ]:
        lines = groups.get(kind, [])
        section = Section(kind=kind, title=title)
        if kind == "summary":
            section.text = "\n".join(text for text, _ in lines)
        elif kind == "skills":
            for text, _ in lines:
                label, separator, body = text.partition(":")
                section.entries.append(
                    Entry(
                        title=label if separator else "Skills",
                        bullets=[
                            Bullet(text=s.strip())
                            for s in re.split(r"[,;]", body if separator else text)
                            if s.strip()
                        ],
                    )
                )
        elif kind in ("experience", "projects"):
            entry: Entry | None = None
            for text, style in lines:
                is_bullet = bool(re.match(r"^[\ufffd•●▪]\s*", text)) or "List Bullet" in style
                is_title = (kind == "projects" and "Heading" in style) or (
                    kind == "experience" and "\t" in text and not is_bullet
                )
                if is_title:
                    entry = Entry()
                    section.entries.append(entry)
                    if kind == "experience":
                        entry.title, _, entry.dates = text.partition("\t")
                    else:
                        entry.title, _, entry.subtitle = text.partition("|")
                        entry.title, entry.subtitle = entry.title.strip(), entry.subtitle.strip()
                elif is_bullet:
                    if entry is None:
                        entry = Entry()
                        section.entries.append(entry)
                    entry.bullets.append(Bullet(text=clean_bullet(text)))
                elif entry is not None:
                    if kind == "experience" and not entry.subtitle:
                        entry.subtitle, _, entry.location = text.partition("|")
                        entry.subtitle, entry.location = entry.subtitle.strip(), entry.location.strip()
                    else:
                        entry.body = (entry.body + "\n" + text).strip()
                else:
                    # Preserve unrecognized paragraphs rather than silently losing them.
                    entry = Entry(body=text)
                    section.entries.append(entry)
        elif kind == "education" and lines:
            section.entries.append(
                Entry(
                    title=lines[0][0],
                    subtitle=lines[1][0] if len(lines) > 1 else "",
                    body="\n".join(t for t, _ in lines[2:]),
                )
            )
        else:
            section.entries = [Entry(title=clean_bullet(text)) for text, _ in lines]
        resume.sections.append(section)
    resume.ledger = [
        Evidence(text=text, source="Original DOCX", source_id=key) for key, text in content_units(resume)
    ]
    report: dict = {
        "docx_filename": path.name,
        "pdf_filename": pdf_path.name if pdf_path else None,
        "paragraph_count": len(paragraphs),
        "section_count": len(groups),
        "warnings": [],
        "differences": [],
        "reviewed": False,
    }
    if any("\ufffd" in text for text, _ in paragraphs):
        report["warnings"].append(
            "The DOCX uses a replacement character as its bullet marker. Only those leading markers were normalized; the original files are unchanged."
        )
    if pdf_path:
        with fitz.open(pdf_path) as pdf:
            pdf_text = "\n".join(page.get_text(sort=True) for page in pdf)
            report["pdf_pages"] = len(pdf)
            report["pdf_dimensions"] = [[round(p.rect.width, 2), round(p.rect.height, 2)] for p in pdf]
        normalized_pdf = normalize(pdf_text)
        for key, text in content_units(resume):
            if normalize(text) not in normalized_pdf:
                report["differences"].append(
                    {
                        "source_id": key,
                        "docx_text": text,
                        "reason": "Not found verbatim in PDF extraction. Review the DOCX text against the original PDF.",
                    }
                )
        report["pdf_text"] = pdf_text
    else:
        report["warnings"].append(
            "No reference PDF supplied. DOCX content imported; visual comparison is unavailable."
        )
    return resume, report
