"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Code2,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  GripVertical,
  Mail,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { moveItem } from "@/lib/api";
import type { Entry, Resume, Section, SectionKind } from "@/lib/types";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

const icons = {
  summary: FileText,
  skills: Code2,
  experience: BriefcaseBusiness,
  projects: BookOpen,
  awards: Award,
  certifications: ShieldCheck,
  education: GraduationCap,
};
const subtitles: Record<SectionKind, string> = {
  summary: "Your introduction, in your own words",
  skills: "Tools and expertise you bring",
  experience: "The work that shaped your career",
  projects: "Ideas you brought to life",
  awards: "Recognition along the way",
  certifications: "Credentials that back your skills",
  education: "Where your foundations began",
};
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
        />
      ) : (
        <input
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
export function ResumeEditor({
  resume,
  update,
}: {
  resume: Resume;
  update: (mutate: (draft: Resume) => void) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(
    resume.sections.find((s) => s.kind === "summary")?.id || null,
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const sectionUpdate = (id: string, mutate: (section: Section) => void) =>
    update((draft) => {
      const s = draft.sections.find((s) => s.id === id);
      if (s) mutate(s);
    });
  const entryUpdate = (
    sid: string,
    eid: string,
    mutate: (entry: Entry) => void,
  ) =>
    sectionUpdate(sid, (s) => {
      const e = s.entries.find((e) => e.id === eid);
      if (e) mutate(e);
    });
  const addEntry = (s: Section) => {
    s.entries.push({
      id: crypto.randomUUID(),
      title: "",
      subtitle: "",
      dates: "",
      location: "",
      body: "",
      bullets: [],
    });
  };
  return (
    <div className="editor-content">
      <div className="pane-caption">
        <span>RESUME CONTENT</span>
        <span className="caption-detail">
          {resume.sections.filter((s) => s.visible).length} sections
        </span>
      </div>
      <section className="profile-card">
        <div className="profile-top">
          <div className="profile-avatar">
            <UserRound size={25} strokeWidth={1.6} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit personal details"
            onClick={() => setProfileOpen(true)}
          >
            <Pencil size={15} />
          </Button>
        </div>
        <h2>{resume.name || "Your name"}</h2>
        <p className="profile-headline">
          {resume.headline || "Add your professional headline"}
        </p>
        <div className="profile-contact">
          {resume.contacts.find((c) => c.url.startsWith("mailto:")) && (
            <span>
              <Mail size={13} />
              {resume.contacts.find((c) => c.url.startsWith("mailto:"))?.label}
            </span>
          )}
          {resume.contacts.find((c) => !c.url) && (
            <span>
              <MapPin size={13} />
              {resume.contacts.find((c) => !c.url)?.label}
            </span>
          )}
        </div>
      </section>
      <div className="section-list">
        {resume.sections.map((section, index) => {
          const Icon = icons[section.kind];
          const open = expanded === section.id;
          return (
            <section
              key={section.id}
              className={`editor-section ${open ? "is-open" : ""} ${!section.visible ? "is-hidden" : ""}`}
            >
              <button
                className="section-trigger"
                aria-expanded={open}
                onClick={() => setExpanded(open ? null : section.id)}
              >
                <span className="section-icon">
                  <Icon size={18} strokeWidth={1.7} />
                </span>
                <span className="section-trigger-text">
                  <strong>{section.title}</strong>
                  <span>{subtitles[section.kind]}</span>
                </span>
                {!section.visible ? (
                  <EyeOff size={15} />
                ) : (
                  section.kind !== "summary" && (
                    <span className="entry-count">
                      {section.kind === "skills"
                        ? section.entries.reduce(
                            (n, e) => n + e.bullets.length,
                            0,
                          )
                        : section.entries.length}
                    </span>
                  )
                )}
                <ChevronDown size={16} className={open ? "rotate" : ""} />
              </button>
              {open && (
                <div className="section-body">
                  <div className="section-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        sectionUpdate(section.id, (s) => {
                          s.visible = !s.visible;
                        })
                      }
                    >
                      {section.visible ? (
                        <Eye size={14} />
                      ) : (
                        <EyeOff size={14} />
                      )}{" "}
                      {section.visible
                        ? "Visible in resume"
                        : "Hidden from resume"}
                    </Button>
                    <div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${section.title} up`}
                        disabled={index === 0}
                        onClick={() =>
                          update((d) => {
                            d.sections = moveItem(d.sections, index, index - 1);
                          })
                        }
                      >
                        <ArrowUp size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${section.title} down`}
                        disabled={index === resume.sections.length - 1}
                        onClick={() =>
                          update((d) => {
                            d.sections = moveItem(d.sections, index, index + 1);
                          })
                        }
                      >
                        <ArrowDown size={14} />
                      </Button>
                    </div>
                  </div>
                  {section.kind === "summary" ? (
                    <>
                      <Field
                        label="Professional summary"
                        value={section.text}
                        onChange={(text) =>
                          sectionUpdate(section.id, (s) => {
                            s.text = text;
                          })
                        }
                        multiline
                        rows={8}
                      />
                      <div className="field-footnote">
                        <span>Keep it clear. Make it yours.</span>
                        <span>
                          {section.text.trim()
                            ? section.text.trim().split(/\s+/).length
                            : 0}{" "}
                          words
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      {section.entries.map((entry, entryIndex) => (
                        <div className="entry-editor" key={entry.id}>
                          <div className="entry-editor-heading">
                            <span>
                              <GripVertical size={13} />
                              {entry.title ||
                                `New ${section.kind === "skills" ? "skill group" : "entry"}`}
                            </span>
                            <div className="compact-actions">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Move entry up"
                                disabled={entryIndex === 0}
                                onClick={() =>
                                  sectionUpdate(section.id, (s) => {
                                    s.entries = moveItem(
                                      s.entries,
                                      entryIndex,
                                      entryIndex - 1,
                                    );
                                  })
                                }
                              >
                                <ArrowUp size={12} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Move entry down"
                                disabled={
                                  entryIndex === section.entries.length - 1
                                }
                                onClick={() =>
                                  sectionUpdate(section.id, (s) => {
                                    s.entries = moveItem(
                                      s.entries,
                                      entryIndex,
                                      entryIndex + 1,
                                    );
                                  })
                                }
                              >
                                <ArrowDown size={12} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="delete-button"
                                aria-label="Remove entry"
                                onClick={() =>
                                  sectionUpdate(section.id, (s) => {
                                    s.entries = s.entries.filter(
                                      (e) => e.id !== entry.id,
                                    );
                                  })
                                }
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </div>
                          <Field
                            label={
                              section.kind === "skills"
                                ? "Group name"
                                : section.kind === "experience"
                                  ? "Employer"
                                  : "Title"
                            }
                            value={entry.title}
                            onChange={(value) =>
                              entryUpdate(section.id, entry.id, (e) => {
                                e.title = value;
                              })
                            }
                          />
                          {section.kind !== "skills" && (
                            <>
                              <Field
                                label={
                                  section.kind === "experience"
                                    ? "Role"
                                    : "Subtitle"
                                }
                                value={entry.subtitle}
                                onChange={(value) =>
                                  entryUpdate(section.id, entry.id, (e) => {
                                    e.subtitle = value;
                                  })
                                }
                              />
                              <div className="field-row">
                                <Field
                                  label="Dates"
                                  value={entry.dates}
                                  onChange={(value) =>
                                    entryUpdate(section.id, entry.id, (e) => {
                                      e.dates = value;
                                    })
                                  }
                                />
                                <Field
                                  label="Location"
                                  value={entry.location}
                                  onChange={(value) =>
                                    entryUpdate(section.id, entry.id, (e) => {
                                      e.location = value;
                                    })
                                  }
                                />
                              </div>
                              <Field
                                label={
                                  section.kind === "projects"
                                    ? "Technology stack"
                                    : "Additional details"
                                }
                                value={entry.body}
                                onChange={(value) =>
                                  entryUpdate(section.id, entry.id, (e) => {
                                    e.body = value;
                                  })
                                }
                                multiline
                                rows={2}
                              />
                            </>
                          )}
                          <div className="bullets-editor">
                            {entry.bullets.map((bullet, bi) => (
                              <div
                                className={`bullet-edit ${section.kind === "skills" ? "skill-edit" : ""}`}
                                key={bullet.id}
                              >
                                <span className="bullet-dot">
                                  {section.kind === "skills" ? "" : "•"}
                                </span>
                                <textarea
                                  aria-label={`${section.kind === "skills" ? "Skill" : "Achievement"} ${bi + 1}`}
                                  rows={section.kind === "skills" ? 1 : 3}
                                  value={bullet.text}
                                  onChange={(event) =>
                                    entryUpdate(section.id, entry.id, (e) => {
                                      e.bullets[bi].text = event.target.value;
                                    })
                                  }
                                />
                                <div className="bullet-actions">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Move bullet up"
                                    disabled={bi === 0}
                                    onClick={() =>
                                      entryUpdate(section.id, entry.id, (e) => {
                                        e.bullets = moveItem(
                                          e.bullets,
                                          bi,
                                          bi - 1,
                                        );
                                      })
                                    }
                                  >
                                    <ArrowUp size={12} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Move bullet down"
                                    disabled={bi === entry.bullets.length - 1}
                                    onClick={() =>
                                      entryUpdate(section.id, entry.id, (e) => {
                                        e.bullets = moveItem(
                                          e.bullets,
                                          bi,
                                          bi + 1,
                                        );
                                      })
                                    }
                                  >
                                    <ArrowDown size={12} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Remove bullet"
                                    className="delete-button"
                                    onClick={() =>
                                      entryUpdate(section.id, entry.id, (e) => {
                                        e.bullets = e.bullets.filter(
                                          (b) => b.id !== bullet.id,
                                        );
                                      })
                                    }
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-accent"
                            onClick={() =>
                              entryUpdate(section.id, entry.id, (e) => {
                                e.bullets.push({
                                  id: crypto.randomUUID(),
                                  text: "",
                                });
                              })
                            }
                          >
                            <Plus size={14} /> Add{" "}
                            {section.kind === "skills"
                              ? "skill"
                              : "achievement"}
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="add-entry"
                        onClick={() => sectionUpdate(section.id, addEntry)}
                      >
                        <Plus size={15} /> Add{" "}
                        {section.kind === "skills" ? "skill group" : "entry"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="editor-note">
        <ShieldCheck size={16} />
        <p>
          Your master is the source of truth.
          <br />
          <span>Job-specific changes live in separate versions.</span>
        </p>
      </div>
      <Dialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        title="Personal details"
        description="Your name, headline, and ways to reach you."
      >
        <div className="dialog-fields">
          <Field
            label="Full name"
            value={resume.name}
            onChange={(name) =>
              update((d) => {
                d.name = name;
              })
            }
          />
          <Field
            label="Professional headline"
            value={resume.headline}
            onChange={(headline) =>
              update((d) => {
                d.headline = headline;
              })
            }
          />
          {resume.contacts.map((c, i) => (
            <div className="contact-edit" key={c.id}>
              <div>
                <Field
                  label={`Contact ${i + 1}`}
                  value={c.label}
                  onChange={(value) =>
                    update((d) => {
                      d.contacts[i].label = value;
                    })
                  }
                />
                <Field
                  label="Link (optional)"
                  value={c.url}
                  onChange={(value) =>
                    update((d) => {
                      d.contacts[i].url = value;
                    })
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove contact"
                onClick={() =>
                  update((d) => {
                    d.contacts = d.contacts.filter((v) => v.id !== c.id);
                  })
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              update((d) => {
                d.contacts.push({
                  id: crypto.randomUUID(),
                  label: "",
                  url: "",
                });
              })
            }
          >
            <Plus size={15} />
            Add contact
          </Button>
        </div>
        <div className="dialog-footer">
          <Button onClick={() => setProfileOpen(false)}>
            <Check size={16} />
            Done
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
