"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  History,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { api, dateLabel, post } from "@/lib/api";
import type { Job, Settings, Suggestion, Version } from "@/lib/types";
import { Button } from "./ui/button";
import { Field } from "./resume-editor";
import { Dialog } from "./ui/dialog";

export function Score({
  value,
  label,
  large = false,
}: {
  value: number | null;
  label: string;
  large?: boolean;
}) {
  return (
    <div className={`score-block ${large ? "score-large" : ""}`}>
      <div
        className="score-ring"
        style={{ "--score": value ?? 0 } as React.CSSProperties}
      >
        <span>
          {value ?? "—"}
          {value !== null && <small>%</small>}
        </span>
      </div>
      <div>
        <strong>{label}</strong>
        <span>
          {value === null
            ? "Not enough evidence to score"
            : large
              ? "Explainable resume coverage"
              : "Based on explicit requirements"}
        </span>
      </div>
    </div>
  );
}

export function JobMatch({
  settings,
  flush,
  notify,
  onVersion,
}: {
  settings: Settings | null;
  flush: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  onVersion: (version: Version) => void;
}) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [useAi, setUseAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [tab, setTab] = useState("coverage");
  const [editing, setEditing] = useState<Suggestion | null>(null);
  const [proposed, setProposed] = useState("");
  const [history, setHistory] = useState<Job[] | null>(null);
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const analyze = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await flush();
      const result = await post<Job>("/jobs", {
        title,
        company,
        description,
        url,
        use_ai: useAi,
      });
      setJob(result);
      setTab("coverage");
      notify("Job analyzed against your saved master.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Analysis failed.", true);
    } finally {
      setBusy(false);
    }
  };
  const decide = async (
    s: Suggestion,
    status: Suggestion["status"],
    text?: string,
  ) => {
    if (!job) return;
    setDecisionBusy(s.id);
    try {
      setJob(
        await api<Job>(`/jobs/${job.id}/suggestions/${s.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status,
            ...(text === undefined ? {} : { proposed: text }),
          }),
        }),
      );
      setEditing(null);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not save your decision.",
        true,
      );
    } finally {
      setDecisionBusy(null);
    }
  };
  const createVersion = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const version = await post<Version>(`/jobs/${job.id}/versions`);
      notify("Tailored version created. Your master is preserved.");
      onVersion(version);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not create version.",
        true,
      );
    } finally {
      setBusy(false);
    }
  };
  if (!job)
    return (
      <div className="page-content match-start">
        <div className="page-intro">
          <div>
            <span className="eyebrow">A MORE INTENTIONAL APPLICATION</span>
            <h1>Find where your story fits.</h1>
            <p>Bring a job description. See the evidence. Make it your own.</p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                setHistory(await api<Job[]>("/jobs"));
              } catch (error) {
                notify(
                  error instanceof Error
                    ? error.message
                    : "Could not load history.",
                  true,
                );
              }
            }}
          >
            <History size={16} />
            Past analyses
          </Button>
        </div>
        <div className="match-grid">
          <form className="surface job-form" onSubmit={analyze}>
            <div className="surface-heading">
              <span className="feature-icon">
                <Target size={20} />
              </span>
              <div>
                <h2>The opportunity</h2>
                <p>Everything starts with the role.</p>
              </div>
            </div>
            <div className="field-row">
              <Field
                label="Job title"
                value={title}
                onChange={setTitle}
                placeholder="e.g. Senior SDET"
              />
              <Field
                label="Company"
                value={company}
                onChange={setCompany}
                placeholder="Company name"
              />
            </div>
            <Field
              label="Job description"
              value={description}
              onChange={setDescription}
              multiline
              rows={12}
              placeholder="Paste the complete job description, including required and preferred skills…"
            />
            <Field
              label="Job URL (optional)"
              value={url}
              onChange={setUrl}
              placeholder="https://…"
            />
            {settings?.ai.configured && (
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={useAi}
                  onChange={(e) => setUseAi(e.target.checked)}
                />
                <span>
                  Include AI suggestions{" "}
                  <small>
                    {settings.ai.mode === "local"
                      ? "Uses your local model."
                      : "Sends resume text and this description to your configured provider."}
                  </small>
                </span>
              </label>
            )}
            <div className="form-bottom">
              <span>
                <ShieldCheck size={14} />
                {useAi
                  ? "Source-validated suggestions"
                  : "Analyzed locally on your device"}
              </span>
              <Button
                type="submit"
                disabled={
                  busy ||
                  !title.trim() ||
                  !company.trim() ||
                  description.trim().length < 30
                }
              >
                {busy ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}{" "}
                {busy ? "Analyzing…" : "Analyze job"}
                <ArrowRight size={16} />
              </Button>
            </div>
          </form>
          <aside className="match-aside">
            <div className="match-art" aria-hidden="true">
              <div className="art-document">
                <div className="art-avatar" />
                <div className="art-line l1" />
                <div className="art-line l2" />
                <div className="art-divider" />
                <div className="art-line l3" />
                <div className="art-line l4" />
                <div className="art-line l5" />
                <div className="art-line l6" />
                <div className="art-line l7" />
              </div>
              <span className="art-check">
                <CheckCheck size={30} />
              </span>
              <span className="art-spark">
                <Sparkles size={22} />
              </span>
            </div>
            <h2>
              A better fit.
              <br />
              An honest story.
            </h2>
            <p>Every match connects to something you’ve actually done.</p>
            <div className="principle">
              <CircleCheck size={19} />
              <div>
                <strong>Know your strengths</strong>
                <span>See required and preferred skill coverage.</span>
              </div>
            </div>
            <div className="principle">
              <CircleHelp size={19} />
              <div>
                <strong>See the gaps clearly</strong>
                <span>Missing evidence stays visible.</span>
              </div>
            </div>
            <div className="principle">
              <ShieldCheck size={19} />
              <div>
                <strong>You decide what changes</strong>
                <span>Review each suggestion before creating a version.</span>
              </div>
            </div>
          </aside>
        </div>
        <Dialog
          open={history !== null}
          onOpenChange={(open) => {
            if (!open) setHistory(null);
          }}
          title="Past job analyses"
          description="Reopen a saved analysis and continue reviewing."
        >
          {history?.length ? (
            <div className="list-rows">
              {history.map((j) => (
                <button
                  className="list-row"
                  key={j.id}
                  onClick={() => {
                    setJob(j);
                    setHistory(null);
                  }}
                >
                  <span>
                    <strong>{j.title}</strong>
                    <small>
                      {j.company} · {dateLabel(j.created_at)}
                    </small>
                  </span>
                  <span className="badge badge-indigo">
                    {j.analysis.score ?? "—"}%
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <History size={30} />
              <h3>A fresh start</h3>
              <p>Your completed analyses will appear here.</p>
            </div>
          )}
        </Dialog>
      </div>
    );
  const analysis = job.analysis;
  const accepted = job.suggestions.filter(
    (s) => s.status === "accepted",
  ).length;
  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <button
            className="text-button back-link"
            onClick={() => setJob(null)}
          >
            <ArrowLeft size={14} />
            Another opportunity
          </button>
          <h1>{job.title}</h1>
          <p>
            {job.company} <span className="inline-separator">·</span> Master
            revision {job.master_revision_id}{" "}
            <span className="inline-separator">·</span>{" "}
            {dateLabel(job.created_at)}
          </p>
        </div>
        <Button
          onClick={createVersion}
          disabled={busy || decisionBusy !== null}
        >
          {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
          Create tailored version
        </Button>
      </div>
      <div className="match-scores surface">
        <Score value={analysis.score} label="Overall match" large />
        <Score value={analysis.required.score} label="Required skills" />
        <Score value={analysis.preferred.score} label="Preferred skills" />
      </div>
      <div className="page-tabs" role="tablist" aria-label="Job analysis views">
        <button
          role="tab"
          aria-selected={tab === "coverage"}
          onClick={() => setTab("coverage")}
        >
          Requirement coverage<span>{analysis.requirements.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "suggestions"}
          onClick={() => setTab("suggestions")}
        >
          Recommendations<span>{job.suggestions.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "description"}
          onClick={() => setTab("description")}
        >
          Job description
        </button>
      </div>
      {analysis.ai_status && (
        <div className="notice">
          <Sparkles size={17} />
          {analysis.ai_status}
        </div>
      )}
      {tab === "coverage" && (
        <>
          <div className="coverage-heading">
            <h2>The evidence behind the match</h2>
            <div className="legend">
              <span>
                <i className="dot-green" />
                Strong
              </span>
              <span>
                <i className="dot-amber" />
                Partial
              </span>
              <span>
                <i className="dot-gray" />
                Missing
              </span>
            </div>
          </div>
          <div className="requirements-list">
            {analysis.requirements.map((r) => (
              <details className="requirement surface" key={r.id}>
                <summary>
                  <span className={`status-icon ${r.status}`}>
                    <Check size={16} />
                  </span>
                  <span className="requirement-title">
                    <strong>{r.name}</strong>
                    <span>
                      {r.category === "required" ? "Required" : "Preferred"} ·
                      Explicit in job description
                    </span>
                  </span>
                  <span
                    className={`badge ${r.status === "strong" ? "badge-green" : r.status === "partial" ? "badge-amber" : "badge-gray"}`}
                  >
                    {r.status === "strong"
                      ? "Strong match"
                      : r.status === "partial"
                        ? "Partial match"
                        : "No evidence"}
                  </span>
                  <ChevronDown size={16} />
                </summary>
                <div className="requirement-detail">
                  <p>{r.explanation}</p>
                  <label>JOB REQUIREMENT</label>
                  <blockquote>{r.job_evidence}</blockquote>
                  <label>YOUR RESUME EVIDENCE</label>
                  {r.evidence.length ? (
                    r.evidence.map((e, i) => (
                      <blockquote key={i}>
                        {e.text}
                        <small>Source: {e.source_id}</small>
                      </blockquote>
                    ))
                  ) : (
                    <p>
                      No supporting claim found. Add experience only after
                      confirming it.
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
          {!analysis.requirements.length && (
            <div className="empty-state surface">
              <Target size={30} />
              <h3>No recognized skill requirements</h3>
              <p>
                This description needs manual review. No match score has been
                invented.
              </p>
            </div>
          )}
          <details className="method-details">
            <summary>
              How this score is calculated
              <ChevronDown size={14} />
            </summary>
            <p>{analysis.method}</p>
            {analysis.limitations.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </details>
          {analysis.unassessed.length > 0 && (
            <div className="surface manual-review">
              <h3>Requirements to review yourself</h3>
              <p>These statements were not scored by the local matcher.</p>
              <ul>
                {analysis.unassessed.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {tab === "suggestions" && (
        <>
          <div className="coverage-heading">
            <div>
              <h2>A thoughtful refinement</h2>
              <p>
                Review each change. {accepted} approved for the tailored
                version.
              </p>
            </div>
            <span className="badge badge-green">
              <ShieldCheck size={13} />
              Evidence backed
            </span>
          </div>
          {job.suggestions.length ? (
            <div className="suggestions-list">
              {job.suggestions.map((s) => (
                <article
                  className={`surface suggestion ${s.status}`}
                  key={s.id}
                >
                  <div className="suggestion-title">
                    <span className="feature-icon">
                      <Sparkles size={17} />
                    </span>
                    <div>
                      <h3>
                        {s.type === "order"
                          ? "Lead with relevant evidence"
                          : "Refine your introduction"}
                      </h3>
                      <span>
                        {s.confidence} confidence · {s.status}
                      </span>
                    </div>
                  </div>
                  <div className="comparison">
                    <div>
                      <label>CURRENT</label>
                      <p>{s.existing}</p>
                    </div>
                    <div className="proposed">
                      <label>PROPOSED</label>
                      <p>{s.proposed}</p>
                    </div>
                  </div>
                  <p className="suggestion-reason">{s.reason}</p>
                  <details className="method-details">
                    <summary>
                      Requirement and supporting evidence
                      <ChevronDown size={14} />
                    </summary>
                    <p>{s.requirement}</p>
                    {s.evidence.map((e, i) => (
                      <blockquote key={i}>
                        {e.text}
                        <small>Source: {e.source_id}</small>
                      </blockquote>
                    ))}
                  </details>
                  <div className="suggestion-controls">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={decisionBusy !== null}
                      onClick={() => {
                        setEditing(s);
                        setProposed(s.proposed);
                      }}
                    >
                      <Pencil size={14} />
                      Edit proposal
                    </Button>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={decisionBusy !== null}
                        onClick={() => decide(s, "rejected")}
                      >
                        <X size={14} />
                        {s.status === "rejected" ? "Rejected" : "Reject"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={decisionBusy !== null}
                        onClick={() =>
                          decide(
                            s,
                            s.status === "accepted" ? "pending" : "accepted",
                          )
                        }
                      >
                        {decisionBusy === s.id ? (
                          <Loader2 className="spin" size={14} />
                        ) : (
                          <Check size={14} />
                        )}{" "}
                        {s.status === "accepted"
                          ? "Approved · Undo"
                          : "Approve change"}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state surface">
              <CircleCheck size={32} />
              <h3>Your evidence is already well ordered</h3>
              <p>
                No safe reordering recommendation was found. You can still
                create a separate version for this role.
              </p>
            </div>
          )}
        </>
      )}
      {tab === "description" && (
        <div className="surface description-view">
          <h2>Original job description</h2>
          <p>{job.description}</p>
          {analysis.responsibilities.length > 0 && (
            <>
              <h3>Core responsibilities identified</h3>
              <ul>
                {analysis.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title="Edit the proposed change"
        description="Select or reorder complete source statements. New facts must be confirmed in your master first."
      >
        <Field
          label="Proposed text"
          value={proposed}
          onChange={setProposed}
          multiline
          rows={10}
        />
        <div className="dialog-footer">
          <Button
            disabled={decisionBusy !== null}
            onClick={() => {
              if (editing) void decide(editing, "accepted", proposed);
            }}
          >
            <Check size={16} />
            Approve edited proposal
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
