"""Append-only revisions and a single optimistic-concurrency master pointer."""

import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import JSON, Integer, String, Text, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

load_dotenv()
ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.getenv("STUDIO_DATA_DIR", str(ROOT / "data"))).resolve()
DATA.mkdir(parents=True, exist_ok=True)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def data_path(*parts: str) -> Path:
    path = DATA.joinpath(*parts).resolve()
    if not path.is_relative_to(DATA):
        raise ValueError("Path must stay inside the studio data directory.")
    return path


class Base(DeclarativeBase):
    pass


class Revision(Base):
    __tablename__ = "revisions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[str] = mapped_column(String, default=now)
    parent_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    snapshot: Mapped[dict] = mapped_column(JSON)


class Meta(Base):
    __tablename__ = "metadata"
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    company: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(String, default="")
    master_revision_id: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[str] = mapped_column(String, default=now)
    analysis: Mapped[dict] = mapped_column(JSON)
    suggestions: Mapped[list] = mapped_column(JSON)


class Version(Base):
    __tablename__ = "versions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    job_id: Mapped[str] = mapped_column(String)
    label: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, default=now)
    master_revision_id: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict] = mapped_column(JSON)
    approved_changes: Mapped[list] = mapped_column(JSON)


class Export(Base):
    __tablename__ = "exports"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    filename: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, default=now)
    revision_id: Mapped[int] = mapped_column(Integer)
    version_id: Mapped[str | None] = mapped_column(String, nullable=True)
    validation: Mapped[dict] = mapped_column(JSON)


engine = create_engine(
    f"sqlite:///{data_path('studio.db').as_posix()}", connect_args={"check_same_thread": False}
)


@event.listens_for(engine, "connect")
def configure_sqlite(connection, _record):
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout=5000")
    connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(engine, expire_on_commit=False)


def master(db: Session) -> Revision | None:
    pointer = db.get(Meta, "master")
    return db.get(Revision, pointer.value["revision_id"]) if pointer else None


def row_dict(row) -> dict:
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}
