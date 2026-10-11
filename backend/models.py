"""Validated domain objects. Entry and bullet identity survives every revision."""

from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


def uid() -> str:
    return uuid4().hex


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Bullet(Model):
    id: str = Field(default_factory=uid, max_length=80)
    text: str = Field(default="", max_length=8000)


class Entry(Model):
    id: str = Field(default_factory=uid, max_length=80)
    title: str = Field(default="", max_length=1000)
    subtitle: str = Field(default="", max_length=1000)
    dates: str = Field(default="", max_length=150)
    location: str = Field(default="", max_length=300)
    body: str = Field(default="", max_length=20000)
    bullets: list[Bullet] = Field(default_factory=list, max_length=200)


class Section(Model):
    id: str = Field(default_factory=uid, max_length=80)
    kind: Literal["summary", "skills", "experience", "projects", "awards", "certifications", "education"]
    title: str = Field(max_length=200)
    visible: bool = True
    text: str = Field(default="", max_length=20000)
    entries: list[Entry] = Field(default_factory=list, max_length=100)


class Contact(Model):
    id: str = Field(default_factory=uid, max_length=80)
    label: str = Field(max_length=300)
    url: str = Field(default="", max_length=500)


class Evidence(Model):
    text: str
    source: str
    source_id: str
    revision_id: int | None = None


class Resume(Model):
    name: str = Field(default="", max_length=200)
    headline: str = Field(default="", max_length=300)
    contacts: list[Contact] = Field(default_factory=list, max_length=20)
    sections: list[Section] = Field(default_factory=list, max_length=20)
    ledger: list[Evidence] = Field(default_factory=list, max_length=5000)

    @model_validator(mode="after")
    def stable_ids(self) -> "Resume":
        ids = [c.id for c in self.contacts]
        for section in self.sections:
            ids.append(section.id)
            for entry in section.entries:
                ids.append(entry.id)
                ids.extend(b.id for b in entry.bullets)
        if len(ids) != len(set(ids)):
            raise ValueError("Every section, entry, contact, and bullet must have a unique ID.")
        return self


class SaveRequest(Model):
    resume: Resume
    base_revision_id: int
    label: str = Field(default="Resume edited", max_length=200)


class JobRequest(Model):
    title: str = Field(min_length=1, max_length=200)
    company: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=30, max_length=60000)
    url: str = Field(default="", max_length=1000)
    use_ai: bool = False


class DecisionRequest(Model):
    status: Literal["accepted", "rejected", "pending"]
    proposed: str | None = Field(default=None, max_length=20000)


class ExportRequest(Model):
    version_id: str | None = None
    revision_id: int | None = None


def content_units(resume: Resume, visible_only: bool = False) -> list[tuple[str, str]]:
    units = [("name", resume.name), ("headline", resume.headline)]
    units.extend((c.id, c.label) for c in resume.contacts)
    for s in resume.sections:
        if visible_only and not s.visible:
            continue
        units.extend([(s.id + ":title", s.title), (s.id, s.text)])
        for e in s.entries:
            units.extend(
                (e.id + ":" + key, getattr(e, key))
                for key in ("title", "dates", "subtitle", "location", "body")
            )
            units.extend((b.id, b.text) for b in e.bullets)
    return [(key, text) for key, text in units if text.strip()]
