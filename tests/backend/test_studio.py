import hashlib
import io
import json
import os
import subprocess
import sys
from zipfile import ZIP_DEFLATED, ZipFile

import fitz
import pytest

from backend.ai import ai_suggestions
from backend.analysis import analyze_job, validate_proposal
from backend.database import DATA, SessionLocal, data_path, master
from backend.importer import parse_docx
from backend.models import Resume, content_units
from backend.pdf_export import validate_pdf
from backend.rendering import render_resume

DESCRIPTION = "Required: Python, Selenium, and JavaScript. Develop automation frameworks and build regression testing pipelines. Preferred: Kubernetes and AWS."


def job(client):
    result = client.post(
        "/api/jobs", json={"title": "SDET", "company": "Test Company", "description": DESCRIPTION}
    )
    assert result.status_code == 200, result.text
    return result.json()


def test_docx_import_preserves_all_content_and_source(docx_path):
    original = hashlib.sha256(docx_path.read_bytes()).hexdigest()
    resume, report = parse_docx(docx_path)
    assert [s.kind for s in resume.sections] == [
        "summary",
        "skills",
        "experience",
        "projects",
        "awards",
        "certifications",
        "education",
    ]
    assert len(resume.sections[2].entries[0].bullets) == 2
    assert "100+" in resume.sections[2].entries[0].bullets[0].text
    assert len(resume.ledger) == len(content_units(resume))
    assert not report["reviewed"]
    assert hashlib.sha256(docx_path.read_bytes()).hexdigest() == original


def test_save_persists_across_process_restart_and_revisions_are_immutable(client, imported):
    snapshot = imported["resume"]
    original_name = snapshot["name"]
    snapshot["name"] = "Confirmed Test Candidate"
    response = client.put(
        "/api/master", json={"resume": snapshot, "base_revision_id": imported["revision_id"]}
    )
    assert response.status_code == 200
    assert response.json()["revision_id"] != imported["revision_id"]
    old = client.get(f"/api/revisions/{imported['revision_id']}").json()
    assert old["snapshot"]["name"] == original_name
    output = subprocess.check_output(
        [
            sys.executable,
            "-c",
            "from backend.database import SessionLocal,master; print(master(SessionLocal()).snapshot['name'])",
        ],
        env={**os.environ, "STUDIO_DATA_DIR": str(DATA)},
        text=True,
    )
    assert output.strip() == "Confirmed Test Candidate"
    stale = client.put("/api/master", json={"resume": snapshot, "base_revision_id": imported["revision_id"]})
    assert stale.status_code == 409


def test_new_master_edits_extend_ledger_instead_of_erasing_it(client, imported):
    snapshot = imported["resume"]
    count = len(snapshot["ledger"])
    snapshot["ledger"] = []
    snapshot["headline"] = "Confirmed user edit"
    result = client.put(
        "/api/master", json={"resume": snapshot, "base_revision_id": imported["revision_id"]}
    ).json()
    assert len(result["resume"]["ledger"]) == count + 1
    assert result["resume"]["ledger"][-1]["source"] == "User-approved master edit"


def test_matching_is_explicit_explainable_and_java_is_not_javascript(imported):
    resume = Resume.model_validate(imported["resume"])
    analysis = analyze_job(resume, DESCRIPTION)
    by_name = {r["name"]: r for r in analysis["requirements"]}
    assert by_name["Python"]["status"] == "strong"
    assert by_name["JavaScript"]["status"] == "partial"
    assert by_name["AWS"]["status"] == "missing"
    assert by_name["AWS"]["category"] == "preferred"
    assert by_name["Python"]["evidence"][0]["source_id"]
    assert analysis["score"] < 100
    assert "Java" not in by_name


@pytest.mark.parametrize(
    "proposed,valid",
    [
        ("Developed Python APIs. Built Selenium test frameworks.", True),
        ("Built Kubernetes infrastructure.", False),
        ("Built Selenium test frameworks. Built Selenium test frameworks.", False),
        ("Did not build Selenium test frameworks.", False),
    ],
)
def test_evidence_gate_rejects_unsupported_claims(proposed, valid):
    assert (
        validate_proposal("Built Selenium test frameworks. Developed Python APIs.", proposed, "text") is valid
    )


def test_recommendation_approval_rejection_and_tailored_isolation(client, imported):
    analysis = job(client)
    assert analysis["suggestions"]
    suggestion = analysis["suggestions"][0]
    endpoint = f"/api/jobs/{analysis['id']}/suggestions/{suggestion['id']}"
    assert (
        client.patch(
            endpoint, json={"status": "accepted", "proposed": "Invented 200% achievement."}
        ).status_code
        == 422
    )
    accepted = client.patch(endpoint, json={"status": "accepted"})
    assert accepted.status_code == 200
    assert accepted.json()["suggestions"][0]["status"] == "accepted"
    second = next((s for s in analysis["suggestions"][1:]), None)
    if second:
        rejected = client.patch(
            f"/api/jobs/{analysis['id']}/suggestions/{second['id']}", json={"status": "rejected"}
        )
        assert rejected.json()["suggestions"][1]["status"] == "rejected"
    tailored = client.post(f"/api/jobs/{analysis['id']}/versions").json()
    assert tailored["approved_changes"][0]["id"] == suggestion["id"]
    assert tailored["snapshot"] != imported["resume"]
    assert client.get("/api/master").json() == imported
    assert client.get(f"/api/versions/{tailored['id']}").json()["job"]["description"] == DESCRIPTION


def test_restore_revision_creates_new_revision(client, imported):
    modified = imported["resume"].copy()
    modified["name"] = "Edited Test"
    saved = client.put(
        "/api/master", json={"resume": modified, "base_revision_id": imported["revision_id"]}
    ).json()
    restored = client.post(f"/api/revisions/{imported['revision_id']}/restore").json()
    assert restored["revision_id"] > saved["revision_id"]
    assert restored["resume"]["name"] == "Test Candidate"
    assert len(client.get("/api/revisions").json()) == 3


def test_ats_does_not_claim_pdf_validation_before_export(client, imported):
    report = client.post("/api/ats", json={}).json()
    assert report["pdf"] is None
    assert any(f["status"] == "unchecked" for f in report["findings"])
    bad = imported["resume"]
    bad["contacts"] = []
    bad["sections"][2]["entries"][0]["dates"] = "2029 - 2022"
    client.put("/api/master", json={"resume": bad, "base_revision_id": imported["revision_id"]})
    report = client.post("/api/ats", json={}).json()
    assert report["score"] < 100
    assert sum(f["status"] == "warning" for f in report["findings"]) >= 3


def test_real_pdf_export_download_dimensions_fonts_and_content(client, imported, tmp_path):
    response = client.post("/api/exports", json={})
    assert response.status_code == 200, response.text
    exported = response.json()
    assert exported["validation"]["valid"]
    assert not exported["validation"]["missing"]
    assert "SegoeUI-Bold" in exported["validation"]["fonts"]
    download = client.get(exported["download_url"])
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF")
    with fitz.open(stream=download.content, filetype="pdf") as pdf:
        assert "Test Candidate" in pdf[0].get_text()
        assert abs(pdf[0].rect.width - 595.28) < 2
        assert abs(pdf[0].rect.height - 841.89) < 2
    assert client.post("/api/ats", json={}).json()["pdf"]["valid"]
    truncated = tmp_path / "missing.pdf"
    with fitz.open() as pdf:
        pdf.new_page().insert_text((50, 50), "Test Candidate")
        pdf.save(truncated)
    assert not validate_pdf(truncated, Resume.model_validate(imported["resume"]))["valid"]


def test_backup_and_restore_preserves_jobs_versions_and_exports(client, imported):
    analysis = job(client)
    version = client.post(f"/api/jobs/{analysis['id']}/versions").json()
    exported = client.post("/api/exports", json={"version_id": version["id"]}).json()
    backup = client.get("/api/backup")
    modified = imported["resume"].copy()
    modified["name"] = "Later edit"
    client.put("/api/master", json={"resume": modified, "base_revision_id": imported["revision_id"]})
    restored = client.post("/api/backup/restore", files={"file": ("backup.zip", backup.content)})
    assert restored.status_code == 200, restored.text
    assert (DATA / "backups" / restored.json()["recovery_backup"]).exists()
    assert client.get("/api/master").json()["resume"]["name"] == "Test Candidate"
    assert client.get(f"/api/versions/{version['id']}").status_code == 200
    assert client.get(f"/api/exports/{exported['id']}/download").status_code == 200


def test_restore_rejects_path_escape_and_keeps_master(client, imported):
    buffer = io.BytesIO()
    original = client.get("/api/backup").content
    with ZipFile(io.BytesIO(original)) as src, ZipFile(buffer, "w", ZIP_DEFLATED) as dst:
        manifest = json.loads(src.read("studio.json"))
        manifest["files"]["../escape.txt"] = hashlib.sha256(b"bad").hexdigest()
        dst.writestr("studio.json", json.dumps(manifest))
        dst.writestr("../escape.txt", b"bad")
        for name in src.namelist():
            if name != "studio.json":
                dst.writestr(name, src.read(name))
    response = client.post("/api/backup/restore", files={"file": ("bad.zip", buffer.getvalue())})
    assert response.status_code == 422
    assert client.get("/api/master").json() == imported
    with pytest.raises(ValueError):
        data_path("..", "escape.txt")


def test_html_escapes_content_and_rejects_javascript_links(imported):
    resume = Resume.model_validate(imported["resume"])
    resume.name = "<script>alert(1)</script>"
    resume.contacts[0].url = "javascript:alert(1)"
    html = render_resume(resume)
    assert "<script>" not in html
    assert "javascript:" not in html
    assert "&lt;script&gt;" in html


def test_ai_local_mode_blocks_external_endpoints_before_network(imported, monkeypatch):
    monkeypatch.setenv("AI_MODE", "local")
    monkeypatch.setenv("AI_BASE_URL", "https://external.example/v1")
    with pytest.raises(ValueError, match="loopback"):
        ai_suggestions(Resume.model_validate(imported["resume"]), DESCRIPTION)


def test_mock_ai_response_must_preserve_source_statements(imported, monkeypatch):
    resume = Resume.model_validate(imported["resume"])
    target = resume.sections[0].id

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "suggestions": [
                                        {
                                            "target_id": target,
                                            "proposed": "Developed Python APIs. Built Selenium test frameworks.",
                                            "reason": "Match Python",
                                        },
                                        {
                                            "target_id": target,
                                            "proposed": "Led Kubernetes migrations with 95% savings.",
                                        },
                                    ]
                                }
                            )
                        }
                    }
                ]
            }

    class Client:
        def __init__(self, **kwargs):
            assert kwargs["follow_redirects"] is False

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def post(self, *args, **kwargs):
            return Response()

    monkeypatch.setenv("AI_MODE", "local")
    monkeypatch.setenv("AI_BASE_URL", "http://127.0.0.1:11434/v1")
    monkeypatch.setattr("backend.ai.httpx.Client", Client)
    proposals = ai_suggestions(resume, DESCRIPTION)
    assert len(proposals) == 1
    assert "Kubernetes" not in proposals[0]["proposed"]


def test_foreign_browser_origin_cannot_write(client, imported):
    assert (
        client.post(
            "/api/jobs",
            json={"title": "bad", "company": "bad", "description": DESCRIPTION},
            headers={"Origin": "https://untrusted.example"},
        ).status_code
        == 403
    )
    assert master(SessionLocal()).id == imported["revision_id"]
