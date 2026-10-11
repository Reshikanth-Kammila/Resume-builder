"""Explainable, conservative matching without an API key or invented evidence."""

import re
from collections import Counter

from .importer import normalize
from .models import Resume, content_units, uid

# Aliases are spelling equivalents, not implied skills. Java never matches JavaScript.
TECHNOLOGIES = {
    "Python": ["python"],
    "Java": ["java", "java 17"],
    "JavaScript": ["javascript"],
    "TypeScript": ["typescript"],
    "SQL": ["sql"],
    "Selenium": ["selenium", "selenium webdriver"],
    "TestNG": ["testng"],
    "Robot Framework": ["robot framework"],
    "pytest": ["pytest"],
    "Playwright": ["playwright"],
    "Cypress": ["cypress"],
    "Appium": ["appium"],
    "REST Assured": ["rest assured", "rest-assured"],
    "Postman": ["postman"],
    "API testing": ["api testing", "api automation"],
    "Regression testing": ["regression testing", "regression test"],
    "UI automation": ["ui automation", "ui and api automation"],
    "CI/CD": ["ci/cd", "ci cd", "continuous integration"],
    "GitHub Actions": ["github actions"],
    "Jenkins": ["jenkins"],
    "Git": ["git"],
    "Maven": ["maven"],
    "Docker": ["docker"],
    "Linux": ["linux"],
    "Kubernetes": ["kubernetes", "k8s"],
    "AWS": ["aws", "amazon web services"],
    "Azure": ["azure"],
    "GCP": ["gcp", "google cloud"],
    "FastAPI": ["fastapi"],
    "React": ["react", "react.js"],
    "Next.js": ["next.js", "nextjs"],
    "Angular": ["angular"],
    "LangChain": ["langchain"],
    "LangGraph": ["langgraph"],
    "OpenCV": ["opencv"],
    "Pydantic": ["pydantic"],
    "SQLAlchemy": ["sqlalchemy"],
    "SQLite": ["sqlite"],
    "PostgreSQL": ["postgresql", "postgres"],
    "MySQL": ["mysql"],
    "JDBC": ["jdbc"],
    "Page Object Model": ["page object model", "pom"],
    "Agile": ["agile", "scrum"],
    "ISTQB": ["istqb"],
    "JUnit": ["junit"],
    "Cucumber": ["cucumber"],
    "BDD": ["bdd", "behavior driven"],
    "JMeter": ["jmeter"],
    "Performance testing": ["performance testing", "load testing"],
    "Security testing": ["security testing"],
    "Visual regression": ["visual regression"],
    "Test data": ["test data", "test-data"],
    "Manual testing": ["manual testing"],
    "Functional testing": ["functional testing", "functional and regression"],
    "Mobile testing": ["mobile testing"],
    "Accessibility testing": ["accessibility testing"],
}


def mentions(text: str, phrase: str) -> bool:
    return bool(re.search(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", text, re.I))


def sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-Z])|\n+", text) if s.strip()]


def analyze_job(resume: Resume, description: str) -> dict:
    units = content_units(resume, visible_only=True)
    # Section headings cannot act as skill evidence.
    units = [
        (key, text) for key, text in units if not key.endswith(":title") and key not in ("name", "headline")
    ]
    requirements = []
    lines = sentences(description)
    preferred_context = False
    categorized: list[tuple[str, str]] = []
    for line in lines:
        if re.search(r"preferred|nice.to.have|bonus|desirable", line, re.I):
            preferred_context = True
        elif re.search(r"required|must.have|requirements|qualifications|responsibilities", line, re.I):
            preferred_context = False
        categorized.append((line, "preferred" if preferred_context else "required"))
    for name, aliases in TECHNOLOGIES.items():
        matching = [
            (line, category) for line, category in categorized if any(mentions(line, a) for a in aliases)
        ]
        if not matching:
            continue
        category = "required" if any(c == "required" for _, c in matching) else "preferred"
        evidence = [
            {"source_id": key, "text": text} for key, text in units if any(mentions(text, a) for a in aliases)
        ]
        # A skills-only claim is explicitly partial, rather than proof of applied work.
        skill_ids = {
            b.id for s in resume.sections if s.kind == "skills" for e in s.entries for b in e.bullets
        }
        applied = [e for e in evidence if e["source_id"] not in skill_ids]
        status = "strong" if applied else "partial" if evidence else "missing"
        requirements.append(
            {
                "id": uid(),
                "name": name,
                "category": category,
                "origin": "explicit",
                "job_evidence": matching[0][0],
                "status": status,
                "evidence": applied[:3] or evidence[:3],
                "explanation": "Demonstrated in resume accomplishments or project descriptions."
                if applied
                else "Listed in skills; applied experience is not demonstrated."
                if evidence
                else "No supporting evidence in the visible resume. Confirm experience before adding this skill.",
            }
        )
    years = re.search(r"(\d+)\s*\+?\s*(?:years|yrs)", description, re.I)
    if years:
        resume_text = " ".join(text for _, text in units)
        claimed = re.search(r"(\d+)\+?\s*years", resume_text, re.I)
        required, existing = int(years.group(1)), int(claimed.group(1)) if claimed else None
        evidence = [
            {"source_id": key, "text": text}
            for key, text in units
            if re.search(r"\d+\+?\s*years", text, re.I)
        ]
        requirements.append(
            {
                "id": uid(),
                "name": f"{required}+ years of experience",
                "category": "required",
                "origin": "explicit",
                "job_evidence": years.group(0),
                "status": "strong"
                if existing is not None and existing >= required
                else "partial"
                if existing
                else "missing",
                "evidence": evidence[:1],
                "explanation": f"The resume explicitly states {existing}+ years. Role-specific duration still needs review."
                if existing
                else "No explicit experience-duration claim found. Dates are not treated as proof of experience in a particular skill.",
            }
        )

    def coverage(category: str):
        items = [r for r in requirements if r["category"] == category]
        return {
            "score": round(
                100
                * sum(1 if r["status"] == "strong" else 0.5 if r["status"] == "partial" else 0 for r in items)
                / len(items)
            )
            if items
            else None,
            "count": len(items),
            "strong": sum(r["status"] == "strong" for r in items),
            "partial": sum(r["status"] == "partial" for r in items),
        }

    required, preferred = coverage("required"), coverage("preferred")
    scored = [(required["score"], 0.8), (preferred["score"], 0.2)]
    scored = [(s, w) for s, w in scored if s is not None]
    score = round(sum(s * w for s, w in scored) / sum(w for _, w in scored)) if scored else None
    responsibilities = [
        line
        for line in lines
        if re.search(r"build|develop|design|maintain|lead|collaborate|execute|deliver|responsib", line, re.I)
    ]
    return {
        "score": score,
        "required": required,
        "preferred": preferred,
        "requirements": requirements,
        "responsibilities": responsibilities[:12],
        "keywords": [r["name"] for r in requirements],
        "method": "Explicit keyword and alias matching. Demonstrated = 1, skills-only = 0.5, missing = 0. Required coverage carries 80% and preferred 20%; absent categories are excluded. This is coverage, not a hiring probability.",
        "limitations": [
            "Unrecognized requirements and implied priorities need your review.",
            "Keyword matches do not verify proficiency, eligibility, or domain experience.",
        ],
        "unassessed": [
            line
            for line in lines
            if len(line) > 30
            and not any(any(mentions(line, a) for a in aliases) for aliases in TECHNOLOGIES.values())
            and not re.search(r"\d+\s*\+?\s*years", line, re.I)
        ][:12],
    }


def build_suggestions(resume: Resume, analysis: dict) -> list[dict]:
    keywords = analysis["keywords"]

    def relevance(text: str) -> int:
        return sum(
            any(mentions(text, alias) for alias in TECHNOLOGIES.get(word, [word])) for word in keywords
        )

    suggestions = []
    for s in resume.sections:
        if s.kind == "summary" and s.text:
            chunks = sentences(s.text)
            arranged = sorted(chunks, key=relevance, reverse=True)
            if chunks != arranged:
                suggestions.append(
                    {
                        "id": uid(),
                        "type": "text",
                        "target_id": s.id,
                        "existing": s.text,
                        "proposed": " ".join(arranged),
                        "reason": "Lead with the existing sentence most relevant to this job. Every sentence comes from your master resume.",
                        "requirement": ", ".join(keywords[:6]),
                        "evidence": [{"source_id": s.id, "text": s.text}],
                        "confidence": "high",
                        "status": "pending",
                    }
                )
        for e in s.entries:
            if len(e.bullets) < 2:
                continue
            arranged = sorted(e.bullets, key=lambda b: relevance(b.text), reverse=True)
            if [b.id for b in arranged] != [b.id for b in e.bullets]:
                suggestions.append(
                    {
                        "id": uid(),
                        "type": "order",
                        "target_id": e.id,
                        "existing": "\n".join(b.text for b in e.bullets),
                        "proposed": "\n".join(b.text for b in arranged),
                        "before_order": [b.id for b in e.bullets],
                        "after_order": [b.id for b in arranged],
                        "reason": "Bring the most relevant existing skills or accomplishments to the top without changing factual claims.",
                        "requirement": ", ".join(keywords[:6]),
                        "evidence": [{"source_id": b.id, "text": b.text} for b in arranged],
                        "confidence": "high",
                        "status": "pending",
                    }
                )
    return suggestions


def validate_proposal(existing: str, proposed: str, suggestion_type: str) -> bool:
    # Conservative gate: full source statements may be selected or reordered.
    # Token overlap alone cannot prove that an AI rewrite preserves facts.
    chunks = existing.splitlines() if suggestion_type == "order" else sentences(existing)
    requested = proposed.splitlines() if suggestion_type == "order" else sentences(proposed)
    available = Counter(normalize(c) for c in chunks if c.strip())
    used = Counter(normalize(c) for c in requested if c.strip())
    return (
        bool(used)
        and all(count <= available.get(key, 0) for key, count in used.items())
        and (suggestion_type != "order" or used == available)
    )


def apply_approved(resume: Resume, suggestions: list[dict]) -> Resume:
    result = resume.model_copy(deep=True)
    for suggestion in suggestions:
        if suggestion["status"] != "accepted":
            continue
        if not validate_proposal(suggestion["existing"], suggestion["proposed"], suggestion["type"]):
            raise ValueError(
                "A proposed change contains a statement that cannot be traced to the master resume."
            )
        found = False
        for section in result.sections:
            if section.id == suggestion["target_id"] and suggestion["type"] == "text":
                section.text = suggestion["proposed"]
                found = True
            for entry in section.entries:
                if entry.id == suggestion["target_id"] and suggestion["type"] == "order":
                    by_text = {b.text: b for b in entry.bullets}
                    entry.bullets = [by_text[t] for t in suggestion["proposed"].splitlines()]
                    found = True
        if not found:
            raise ValueError("Suggestion target no longer exists in its source revision.")
    return result
