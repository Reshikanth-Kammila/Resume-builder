import hashlib
import io
import json
import os
import shutil
from contextlib import asynccontextmanager
from pathlib import Path
from zipfile import BadZipFile, ZIP_DEFLATED, ZipFile

from alembic import command
from alembic.config import Config
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, Response
from pydantic import ValidationError
from sqlalchemy import delete, select, update

from .ai import ai_suggestions, configuration
from .analysis import analyze_job, apply_approved, build_suggestions, validate_proposal
from .ats import ats_report
from .database import (
    DATA,
    ROOT,
    Export,
    Job,
    Meta,
    Revision,
    SessionLocal,
    Version,
    data_path,
    master,
    now,
    row_dict,
)
from .importer import parse_docx
from .models import (
    DecisionRequest,
    Evidence,
    ExportRequest,
    JobRequest,
    Resume,
    SaveRequest,
    content_units,
    uid,
)
from .pdf_export import export_pdf, filename
from .rendering import render_resume


def migrate():
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "backend" / "migrations"))
    command.upgrade(config, "head")


def initial_import(docx_path: Path, pdf_path: Path | None = None):
    with SessionLocal.begin() as db:
        if master(db):
            return
        resume, report = parse_docx(docx_path, pdf_path)
        originals = data_path("imports")
        originals.mkdir(parents=True, exist_ok=True)
        target = originals / "original.docx"
        if docx_path.resolve() != target.resolve():
            shutil.copy2(docx_path, target)
        if pdf_path:
            pdf_target = originals / "original.pdf"
            if pdf_path.resolve() != pdf_target.resolve():
                shutil.copy2(pdf_path, pdf_target)
        revision = Revision(label="Original resume imported", snapshot=resume.model_dump())
        db.add(revision)
        db.flush()
        db.add(Meta(key="master", value={"revision_id": revision.id}))
        db.add(Meta(key="import", value=report))


@asynccontextmanager
async def lifespan(_app):
    migrate()
    source = os.getenv("RESUME_DOCX")
    if source and Path(source).is_file():
        pdf = os.getenv("RESUME_PDF")
        initial_import(Path(source), Path(pdf) if pdf and Path(pdf).is_file() else None)
    yield


app = FastAPI(title="Reshi Resume Studio", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def local_request_guard(request: Request, call_next):
    # Browser writes must come from this local app. CORS is deliberately absent.
    origin = request.headers.get("origin")
    if origin and origin not in {
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:3100",
        "http://localhost:3100",
    }:
        return Response("Only the local studio may access this API.", status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


def required_master(db) -> Revision:
    revision = master(db)
    if not revision:
        raise HTTPException(404, "Import your DOCX to open your resume.")
    return revision


def resolve_resume(
    db, version_id: str | None = None, revision_id: int | None = None
) -> tuple[Resume, int, str | None]:
    if version_id and revision_id:
        raise HTTPException(422, "Choose a version or a revision, not both.")
    if version_id:
        version = db.get(Version, version_id)
        if not version:
            raise HTTPException(404, "Version not found.")
        return Resume.model_validate(version.snapshot), version.master_revision_id, version.id
    revision = db.get(Revision, revision_id) if revision_id else required_master(db)
    if not revision:
        raise HTTPException(404, "Revision not found.")
    return Resume.model_validate(revision.snapshot), revision.id, None


@app.get("/api/health")
def health():
    return {"status": "ok", "local": True}


@app.get("/api/master")
def get_master():
    with SessionLocal() as db:
        revision = required_master(db)
        return {"resume": revision.snapshot, "revision_id": revision.id, "created_at": revision.created_at}


@app.put("/api/master")
def save_master(request: SaveRequest):
    with SessionLocal.begin() as db:
        previous = required_master(db)
        if previous.id != request.base_revision_id:
            raise HTTPException(409, "The master changed in another window. Reload before saving.")
        if previous.snapshot == request.resume.model_dump():
            return {
                "resume": previous.snapshot,
                "revision_id": previous.id,
                "created_at": previous.created_at,
            }
        resume = request.resume.model_copy(deep=True)
        # Preserve the server's complete ledger; the editor cannot erase provenance.
        resume.ledger = Resume.model_validate(previous.snapshot).ledger
        ledger = {(e.source_id, e.text) for e in resume.ledger}
        for key, text in content_units(resume):
            if (key, text) not in ledger:
                resume.ledger.append(
                    Evidence(
                        text=text, source="User-approved master edit", source_id=key, revision_id=previous.id
                    )
                )
        revision = Revision(label=request.label, parent_id=previous.id, snapshot=resume.model_dump())
        db.add(revision)
        db.flush()
        # Atomic compare-and-swap also handles two simultaneous request transactions.
        result = db.execute(
            update(Meta)
            .where(Meta.key == "master", Meta.value["revision_id"].as_integer() == previous.id)
            .values(value={"revision_id": revision.id})
        )
        if result.rowcount != 1:
            raise HTTPException(409, "A concurrent edit was saved first. Reload before saving.")
        return {"resume": revision.snapshot, "revision_id": revision.id, "created_at": revision.created_at}


@app.get("/api/revisions")
def revisions():
    with SessionLocal() as db:
        return [
            {"id": r.id, "label": r.label, "created_at": r.created_at, "parent_id": r.parent_id}
            for r in db.scalars(select(Revision).order_by(Revision.id.desc()))
        ]


@app.get("/api/revisions/{revision_id}")
def get_revision(revision_id: int):
    with SessionLocal() as db:
        revision = db.get(Revision, revision_id)
        if not revision:
            raise HTTPException(404, "Revision not found.")
        return row_dict(revision)


@app.post("/api/revisions/{revision_id}/restore")
def restore_revision(revision_id: int):
    with SessionLocal.begin() as db:
        previous = required_master(db)
        old = db.get(Revision, revision_id)
        if not old:
            raise HTTPException(404, "Revision not found.")
        revision = Revision(label=f"Restored revision {old.id}", parent_id=previous.id, snapshot=old.snapshot)
        db.add(revision)
        db.flush()
        result = db.execute(
            update(Meta)
            .where(Meta.key == "master", Meta.value["revision_id"].as_integer() == previous.id)
            .values(value={"revision_id": revision.id})
        )
        if result.rowcount != 1:
            raise HTTPException(409, "Master changed while restoring. Try again.")
        return {"resume": revision.snapshot, "revision_id": revision.id, "created_at": revision.created_at}


@app.post("/api/preview", response_class=HTMLResponse)
def preview(resume: Resume):
    return HTMLResponse(
        render_resume(resume, preview=True),
        headers={
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; base-uri 'none'"
        },
    )


@app.get("/api/import/report")
def import_report():
    with SessionLocal() as db:
        report = db.get(Meta, "import")
        return report.value if report else None


@app.post("/api/import/review")
def review_import():
    with SessionLocal.begin() as db:
        report = db.get(Meta, "import")
        if not report:
            raise HTTPException(404, "No import to review.")
        report.value = {**report.value, "reviewed": True, "reviewed_at": now()}
        return report.value


@app.get("/api/import/original/{kind}")
def original(kind: str):
    if kind not in ("docx", "pdf"):
        raise HTTPException(404, "Original not found.")
    path = data_path("imports", "original." + kind)
    if not path.is_file():
        raise HTTPException(404, "No reference file supplied.")
    return FileResponse(path, filename=path.name)


@app.post("/api/import")
async def upload_import(docx: UploadFile = File(...), pdf: UploadFile | None = File(default=None)):
    with SessionLocal() as db:
        if master(db):
            raise HTTPException(409, "A master already exists. Use backup restore to replace it safely.")
    imports = data_path("imports")
    imports.mkdir(exist_ok=True)
    staging = data_path("imports", uid())
    staging.mkdir()
    try:
        for upload, kind in [(docx, "docx"), (pdf, "pdf")]:
            if not upload:
                continue
            if not (upload.filename or "").lower().endswith("." + kind):
                raise HTTPException(422, f"Select a .{kind} file.")
            contents = await upload.read(20_000_001)
            if len(contents) > 20_000_000:
                raise HTTPException(413, "Each import file must be under 20 MB.")
            (staging / ("original." + kind)).write_bytes(contents)
        try:
            initial_import(staging / "original.docx", staging / "original.pdf" if pdf else None)
        except (ValueError, BadZipFile, RuntimeError) as exc:
            raise HTTPException(422, "Import failed: " + str(exc)) from exc
        return get_master()
    finally:
        shutil.rmtree(staging)


@app.post("/api/jobs")
def create_job(request: JobRequest):
    with SessionLocal.begin() as db:
        revision = required_master(db)
        resume = Resume.model_validate(revision.snapshot)
        analysis = analyze_job(resume, request.description)
        suggestions = build_suggestions(resume, analysis)
        if request.use_ai:
            try:
                additional = ai_suggestions(resume, request.description)
                occupied = {s["target_id"] for s in suggestions}
                suggestions += [s for s in additional if s["target_id"] not in occupied]
                analysis["ai_status"] = (
                    "Source-validated AI suggestions included."
                    if additional
                    else "Provider returned no source-valid suggestions. Local recommendations are available."
                )
            except Exception:
                # Do not leak provider response, secrets, or raw resume data in errors.
                analysis["ai_status"] = (
                    "AI provider unavailable or response could not be validated. Local analysis completed; no unsupported AI suggestion was accepted. Check provider configuration."
                )
        job = Job(
            id=uid(),
            title=request.title,
            company=request.company,
            description=request.description,
            url=request.url,
            master_revision_id=revision.id,
            analysis=analysis,
            suggestions=suggestions,
        )
        db.add(job)
        db.flush()
        return row_dict(job)


@app.get("/api/jobs")
def jobs():
    with SessionLocal() as db:
        return [row_dict(j) for j in db.scalars(select(Job).order_by(Job.created_at.desc()))]


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    with SessionLocal() as db:
        job = db.get(Job, job_id)
        if not job:
            raise HTTPException(404, "Job analysis not found.")
        return row_dict(job)


@app.patch("/api/jobs/{job_id}/suggestions/{suggestion_id}")
def decide_suggestion(job_id: str, suggestion_id: str, request: DecisionRequest):
    with SessionLocal.begin() as db:
        job = db.get(Job, job_id)
        if not job:
            raise HTTPException(404, "Job analysis not found.")
        suggestions = json.loads(json.dumps(job.suggestions))
        suggestion = next((s for s in suggestions if s["id"] == suggestion_id), None)
        if not suggestion:
            raise HTTPException(404, "Suggestion not found.")
        proposed = request.proposed if request.proposed is not None else suggestion["proposed"]
        if request.status == "accepted" and not validate_proposal(
            suggestion["existing"], proposed, suggestion["type"]
        ):
            raise HTTPException(
                422,
                "Unsupported statement. This change may only select or reorder complete statements from its source. Add new confirmed facts to your master first.",
            )
        suggestion.update(status=request.status, proposed=proposed)
        job.suggestions = suggestions
        db.flush()
        return row_dict(job)


@app.post("/api/jobs/{job_id}/versions")
def create_version(job_id: str):
    with SessionLocal.begin() as db:
        job = db.get(Job, job_id)
        if not job:
            raise HTTPException(404, "Job analysis not found.")
        revision = db.get(Revision, job.master_revision_id)
        try:
            tailored = apply_approved(Resume.model_validate(revision.snapshot), job.suggestions)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        version = Version(
            id=uid(),
            job_id=job.id,
            label=f"{job.company} · {job.title}",
            master_revision_id=revision.id,
            snapshot=tailored.model_dump(),
            approved_changes=[s for s in job.suggestions if s["status"] == "accepted"],
        )
        db.add(version)
        db.flush()
        return row_dict(version)


@app.get("/api/versions")
def versions():
    with SessionLocal() as db:
        return [row_dict(v) for v in db.scalars(select(Version).order_by(Version.created_at.desc()))]


@app.get("/api/versions/{version_id}")
def get_version(version_id: str):
    with SessionLocal() as db:
        version = db.get(Version, version_id)
        if not version:
            raise HTTPException(404, "Version not found.")
        return {**row_dict(version), "job": row_dict(db.get(Job, version.job_id))}


@app.post("/api/ats")
def ats(request: ExportRequest):
    with SessionLocal() as db:
        resume, revision_id, version_id = resolve_resume(db, request.version_id, request.revision_id)
        query = (
            select(Export)
            .where(Export.version_id == version_id, Export.revision_id == revision_id)
            .order_by(Export.created_at.desc())
        )
        exported = db.scalars(query).first()
        path = data_path("exports", exported.id + ".pdf") if exported else None
        version = db.get(Version, version_id) if version_id else None
        job = db.get(Job, version.job_id) if version else None
        return ats_report(resume, path if path and path.exists() else None, job.analysis if job else None)


@app.post("/api/exports")
def export(request: ExportRequest):
    with SessionLocal.begin() as db:
        resume, revision_id, version_id = resolve_resume(db, request.version_id, request.revision_id)
        export_id = uid()
        path = data_path("exports", export_id + ".pdf")
        try:
            validation = export_pdf(resume, path)
        except Exception as exc:
            raise HTTPException(422, "Could not create a validated PDF. " + str(exc)[:1000]) from exc
        exported = Export(
            id=export_id,
            filename=filename(resume.name + ("_Tailored" if version_id else "_Master")),
            revision_id=revision_id,
            version_id=version_id,
            validation=validation,
        )
        db.add(exported)
        db.flush()
        return {**row_dict(exported), "download_url": f"/api/exports/{export_id}/download"}


@app.get("/api/exports")
def export_history():
    with SessionLocal() as db:
        return [row_dict(e) for e in db.scalars(select(Export).order_by(Export.created_at.desc()))]


@app.get("/api/exports/{export_id}/download")
def download(export_id: str):
    with SessionLocal() as db:
        exported = db.get(Export, export_id)
        if not exported:
            raise HTTPException(404, "Export not found.")
        path = data_path("exports", exported.id + ".pdf")
        if not path.is_file():
            raise HTTPException(404, "The exported file is missing. Regenerate it from the saved revision.")
        return FileResponse(path, media_type="application/pdf", filename=exported.filename)


@app.get("/api/settings")
def settings():
    return {
        "privacy": "Local only",
        "data_directory": str(DATA),
        "ai": configuration(),
        "font": "Segoe UI",
        "font_weights": {"body": 400, "emphasis": 600, "headings": 700},
        "telemetry": False,
    }


TABLES = [Revision, Meta, Job, Version, Export]


def backup_bytes() -> bytes:
    buffer = io.BytesIO()
    with SessionLocal() as db, ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        manifest = {
            "schema": 1,
            "created_at": now(),
            "tables": {
                table.__tablename__: [row_dict(r) for r in db.scalars(select(table))] for table in TABLES
            },
            "files": {},
        }
        files = [
            p
            for folder in (data_path("imports"), data_path("exports"))
            if folder.exists()
            for p in folder.iterdir()
            if p.is_file() and p.suffix in (".pdf", ".docx")
        ]
        for path in files:
            contents = path.read_bytes()
            relative = path.relative_to(DATA).as_posix()
            archive.writestr(relative, contents)
            manifest["files"][relative] = hashlib.sha256(contents).hexdigest()
        archive.writestr("studio.json", json.dumps(manifest, ensure_ascii=False))
    return buffer.getvalue()


@app.get("/api/backup")
def backup():
    return Response(
        backup_bytes(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="Reshi_Studio_Backup_{now()[:10]}.zip"'},
    )


@app.post("/api/backup/restore")
async def restore_backup(file: UploadFile = File(...)):
    contents = await file.read(80_000_001)
    if len(contents) > 80_000_000:
        raise HTTPException(413, "Backup must be under 80 MB.")
    try:
        with ZipFile(io.BytesIO(contents)) as archive:
            if sum(i.file_size for i in archive.infolist()) > 160_000_000 or len(archive.infolist()) > 2000:
                raise ValueError("Backup exceeds safe size limits.")
            manifest = json.loads(archive.read("studio.json"))
            if manifest.get("schema") != 1 or set(manifest["tables"]) != {t.__tablename__ for t in TABLES}:
                raise ValueError("Unsupported backup format.")
            table_data = manifest["tables"]
            for table in TABLES:
                allowed = {c.name for c in table.__table__.columns}
                for row in table_data[table.__tablename__]:
                    if set(row) != allowed:
                        raise ValueError("Invalid backup table fields.")
            revisions = {r["id"]: r for r in table_data["revisions"]}
            jobs = {j["id"]: j for j in table_data["jobs"]}
            versions = {v["id"]: v for v in table_data["versions"]}
            for row in [*revisions.values(), *versions.values()]:
                Resume.model_validate(row["snapshot"])
            pointer = next((m for m in table_data["metadata"] if m["key"] == "master"), None)
            if pointer and pointer["value"]["revision_id"] not in revisions:
                raise ValueError("Backup master revision is missing.")
            for job in jobs.values():
                if job["master_revision_id"] not in revisions:
                    raise ValueError("Backup job source is missing.")
                JobRequest(
                    title=job["title"], company=job["company"], description=job["description"], url=job["url"]
                )
            for v in versions.values():
                if v["job_id"] not in jobs or v["master_revision_id"] not in revisions:
                    raise ValueError("Backup version source is missing.")
            verified_files = {}
            import re

            for name, digest in manifest["files"].items():
                if not re.fullmatch(r"(?:exports/[a-f0-9]{32}\.pdf|imports/original\.(?:pdf|docx))", name):
                    raise ValueError("Invalid backup file path.")
                data_path(name)
                data = archive.read(name)
                if hashlib.sha256(data).hexdigest() != digest:
                    raise ValueError("Backup file checksum failed.")
                verified_files[name] = data
            for e in table_data["exports"]:
                if e["revision_id"] not in revisions or (e["version_id"] and e["version_id"] not in versions):
                    raise ValueError("Backup export source is missing.")
                if f"exports/{e['id']}.pdf" not in verified_files:
                    raise ValueError("A backup export PDF is missing.")
    except (BadZipFile, KeyError, TypeError, ValueError, ValidationError) as exc:
        raise HTTPException(422, "Backup rejected: " + str(exc)[:500]) from exc
    recovery = data_path("backups", "before_restore_" + uid() + ".zip")
    recovery.parent.mkdir(exist_ok=True)
    recovery.write_bytes(backup_bytes())
    # The prior complete state is retained before any replacement.
    with SessionLocal.begin() as db:
        for table in reversed(TABLES):
            db.execute(delete(table))
        for table in TABLES:
            for row in table_data[table.__tablename__]:
                db.add(table(**row))
        db.flush()
        for name, data in verified_files.items():
            target = data_path(name)
            target.parent.mkdir(exist_ok=True)
            target.write_bytes(data)
    return {"restored": True, "recovery_backup": recovery.name}
