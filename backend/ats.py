"""Scores report what was actually checked, including the actual PDF when supplied."""

import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from .models import Resume, content_units
from .pdf_export import validate_pdf


def ats_report(resume: Resume, pdf_path: Path | None = None, analysis: dict | None = None) -> dict:
    findings = []
    categories = []

    def category(name: str, checks: list[tuple[bool, str, str, str]]):
        for passed, title, detail, fix in checks:
            findings.append(
                {
                    "category": name,
                    "status": "passed" if passed else "warning",
                    "title": title,
                    "detail": detail,
                    "fix": "" if passed else fix,
                }
            )
        categories.append({"name": name, "score": round(100 * sum(c[0] for c in checks) / len(checks))})

    text = "\n".join(t for _, t in content_units(resume, True))
    visible = [s for s in resume.sections if s.visible]
    category(
        "Structure",
        [
            (
                all(s.title.strip() for s in visible),
                "Clear section headings",
                "Every visible section needs a readable heading.",
                "Add a title to empty section headings.",
            ),
            (
                all(s.text.strip() or s.entries for s in visible),
                "Complete visible sections",
                "Empty sections are excluded by the renderer.",
                "Add content or hide empty sections.",
            ),
            (
                any(s.kind == "experience" and s.entries for s in visible),
                "Work experience present",
                "Standard section semantics help text extraction.",
                "Add or unhide work experience.",
            ),
        ],
    )
    category(
        "Contact details",
        [
            (
                bool(resume.name.strip()),
                "Readable name",
                "Your name is rendered as selectable text.",
                "Add your name.",
            ),
            (
                bool(re.search(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", text, re.I)),
                "Email address",
                "Checks the visible contact text.",
                "Add a readable email contact.",
            ),
            (
                any(len(re.sub(r"\D", "", c.label)) >= 9 for c in resume.contacts),
                "Phone number",
                "Checks for at least nine digits in a contact.",
                "Add a readable phone contact.",
            ),
        ],
    )
    bullets = [
        b.text.strip().lower() for s in visible if s.kind != "skills" for e in s.entries for b in e.bullets
    ]
    duplicate = [b for b, n in Counter(bullets).items() if b and n > 1]
    year = datetime.now().year
    bad_dates = []
    for s in visible:
        if s.kind != "experience":
            continue
        for e in s.entries:
            years = [int(y) for y in re.findall(r"\b(19\d{2}|20\d{2})\b", e.dates)]
            if not years or (len(years) > 1 and years[0] > years[1]) or any(y > year for y in years):
                bad_dates.append(e.title)
    category(
        "Content quality",
        [
            (
                not duplicate,
                "Unique achievement bullets",
                f"{len(duplicate)} duplicate bullets detected.",
                "Remove or clarify repeated achievements.",
            ),
            (
                not bad_dates,
                "Consistent experience dates",
                "Checks missing years, reversed year ranges, and future years. Overlapping months need manual review.",
                "Review dates for: " + ", ".join(bad_dates),
            ),
            (
                "\ufffd" not in text,
                "Valid text characters",
                "Checks replacement glyphs in the saved content.",
                "Replace invalid characters with readable text.",
            ),
        ],
    )
    invalid_links = [
        c.label
        for c in resume.contacts
        if c.url
        and not (
            c.url.startswith(("mailto:", "tel:"))
            or (urlparse(c.url).scheme in ("http", "https") and urlparse(c.url).netloc)
        )
    ]
    category(
        "Links and readability",
        [
            (
                not invalid_links,
                "Valid hyperlink syntax",
                "Syntax checked locally. Website availability is not tested and does not affect the score.",
                "Correct links for " + ", ".join(invalid_links),
            ),
            (
                all(len(b.split()) < 65 for b in bullets),
                "Scannable achievements",
                "Flags bullets longer than 65 words.",
                "Split very long bullets while preserving their facts.",
            ),
        ],
    )
    pdf_validation = None
    if pdf_path:
        pdf_validation = validate_pdf(pdf_path, resume)
        category(
            "Exported PDF",
            [
                (
                    pdf_validation["valid"],
                    "Actual PDF validation",
                    f"Checked {pdf_validation['pages']} pages for A4 dimensions, blank pages, content completeness, reading order, bounds, links and invalid glyphs.",
                    "; ".join(pdf_validation["errors"]),
                )
            ],
        )
    else:
        findings.append(
            {
                "category": "Exported PDF",
                "status": "unchecked",
                "title": "Export a PDF to complete validation",
                "detail": "Preview checks cannot verify the final file. PDF integrity is excluded from this score until an export is validated.",
                "fix": "Download a validated PDF, then run this analysis again.",
            }
        )
    if analysis:
        coverage = analysis.get("required", {}).get("score")
        categories.append({"name": "Required skill coverage", "score": coverage})
        findings.append(
            {
                "category": "Job relevance",
                "status": "passed" if coverage is not None and coverage >= 80 else "warning",
                "title": "Job-specific coverage",
                "detail": analysis["method"],
                "fix": "Review unmatched requirements; do not add unsupported skills.",
            }
        )
    values = [c["score"] for c in categories if c["score"] is not None]
    return {
        "score": round(sum(values) / len(values)),
        "categories": categories,
        "findings": findings,
        "pdf": pdf_validation,
        "disclaimer": "These are explainable readiness checks, not a simulation of an employer’s proprietary ATS or a guarantee of an interview.",
    }
