"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Clock3,
  Copy,
  Download,
  FileText,
  GitBranch,
  History,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { api, dateLabel, post } from "@/lib/api";
import type { Master, Resume, Revision, Version } from "@/lib/types";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { ResumePreview } from "./resume-preview";

export function Versions({
  notify,
  flush,
  onRestore,
  exportPdf,
  initialVersion,
  onMatch,
}: {
  notify: (message: string, error?: boolean) => void;
  flush: () => Promise<void>;
  onRestore: (master: Master) => void;
  exportPdf: (versionId?: string, revisionId?: number) => Promise<void>;
  initialVersion: Version | null;
  onMatch: () => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [tab, setTab] = useState("tailored");
  const [selected, setSelected] = useState<Version | null>(initialVersion);
  const [restore, setRestore] = useState<Revision | null>(null);
  const [busy, setBusy] = useState(false);
  const [oldResume, setOldResume] = useState<Resume | null>(null);
  const refresh = useCallback(async () => {
    try {
      await flush();
      const [v, r] = await Promise.all([
        api<Version[]>("/versions"),
        api<Revision[]>("/revisions"),
      ]);
      setVersions(v);
      setRevisions(r);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not load versions.",
        true,
      );
    }
  }, [flush, notify]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load persisted versions asynchronously when opening the screen.
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    void api<Revision>(`/revisions/${selected.master_revision_id}`)
      .then((r) => {
        if (active) setOldResume(r.snapshot || null);
      })
      .catch((e) => notify(e.message, true));
    return () => {
      active = false;
    };
  }, [selected, notify]);
  const restoreRevision = async () => {
    if (!restore) return;
    setBusy(true);
    try {
      const result = await post<Master>(`/revisions/${restore.id}/restore`);
      onRestore(result);
      setRestore(null);
      notify(
        "Restored as a new master revision. Earlier revisions remain available.",
      );
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Restore failed.", true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">ONE MASTER. MANY POSSIBILITIES.</span>
          <h1>Your story, in every version.</h1>
          <p>
            A dedicated resume for each opportunity, with your original always
            safe.
          </p>
        </div>
        <Button onClick={onMatch}>
          <Target size={16} />
          Tailor for a job
          <ArrowRight size={16} />
        </Button>
      </div>
      <div className="page-tabs" role="tablist" aria-label="Resume history">
        <button
          role="tab"
          aria-selected={tab === "tailored"}
          onClick={() => setTab("tailored")}
        >
          Tailored versions<span>{versions.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "history"}
          onClick={() => setTab("history")}
        >
          Master history<span>{revisions.length}</span>
        </button>
      </div>
      {tab === "tailored" &&
        (versions.length ? (
          <div className="version-grid">
            {versions.map((v) => (
              <article className="surface version-card" key={v.id}>
                <div className="version-card-top">
                  <div className="version-icon">
                    <FileText size={23} />
                  </div>
                  <span className="badge badge-indigo">Tailored</span>
                </div>
                <h2>{v.label}</h2>
                <p>{dateLabel(v.created_at)}</p>
                <div className="version-meta">
                  <span>
                    <GitBranch size={14} />
                    From master revision {v.master_revision_id}
                  </span>
                  <span>
                    <ShieldCheck size={14} />
                    {v.approved_changes.length} approved changes
                  </span>
                </div>
                <div className="version-card-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelected(v);
                      setOldResume(null);
                    }}
                  >
                    Open & compare
                    <ArrowRight size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Download ${v.label}`}
                    onClick={() => exportPdf(v.id)}
                  >
                    <Download size={16} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state surface generous">
            <div className="empty-art">
              <Copy size={38} strokeWidth={1.4} />
            </div>
            <h2>The right version for the right role.</h2>
            <p>
              Analyze a job description, review the suggested changes,
              <br />
              and keep a separate resume for that opportunity.
            </p>
            <Button onClick={onMatch}>
              Find your next match
              <ArrowRight size={16} />
            </Button>
          </div>
        ))}
      {tab === "history" && (
        <div className="surface revision-list">
          {revisions.map((r, i) => (
            <div className="revision-row" key={r.id}>
              <div className="timeline-icon">
                {i === 0 ? <FileText size={18} /> : <History size={18} />}
              </div>
              <div>
                <h3>
                  {r.label}
                  {i === 0 && (
                    <span className="badge badge-green">Current master</span>
                  )}
                </h3>
                <p>
                  Revision {r.id} <span className="inline-separator">·</span>{" "}
                  {dateLabel(r.created_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    const full = await api<Revision>(`/revisions/${r.id}`);
                    setRestore(full);
                  } catch (error) {
                    notify(
                      error instanceof Error
                        ? error.message
                        : "Could not open revision.",
                      true,
                    );
                  }
                }}
              >
                <RotateCcw size={14} />
                Review & restore
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="privacy-footnote">
        <ShieldCheck size={14} />
        Your master and tailored versions are stored separately on this device.
      </p>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.label || "Tailored version"}
        description={`Immutable version from master revision ${selected?.master_revision_id || ""}. Only approved changes were applied.`}
        wide
      >
        {selected && (
          <>
            <div className="version-compare">
              <div>
                <h3>
                  <Clock3 size={16} />
                  What changed
                </h3>
                {selected.approved_changes.length ? (
                  selected.approved_changes.map((s) => (
                    <details key={s.id} className="compare-change">
                      <summary>{s.reason}</summary>
                      <div className="comparison">
                        <div>
                          <label>MASTER</label>
                          <p>{s.existing}</p>
                        </div>
                        <div className="proposed">
                          <label>TAILORED</label>
                          <p>{s.proposed}</p>
                        </div>
                      </div>
                    </details>
                  ))
                ) : (
                  <p>
                    No changes were approved; this version preserves its source
                    revision.
                  </p>
                )}
                {oldResume && (
                  <p className="small-note">
                    Compared against the original {oldResume.name} master
                    revision, not the latest master.
                  </p>
                )}
              </div>
              <ResumePreview resume={selected.snapshot} />
            </div>
            <div className="dialog-footer">
              <Button onClick={() => exportPdf(selected.id)}>
                <Download size={16} />
                Download this version
              </Button>
            </div>
          </>
        )}
      </Dialog>
      <Dialog
        open={!!restore}
        onOpenChange={(open) => {
          if (!open) setRestore(null);
        }}
        title={`Review revision ${restore?.id || ""}`}
        description="Restoring creates a new revision. All intervening master revisions stay available."
        wide
      >
        {restore?.snapshot && (
          <div className="revision-preview">
            <ResumePreview resume={restore.snapshot} />
          </div>
        )}
        <div className="dialog-footer">
          <Button variant="outline" onClick={() => setRestore(null)}>
            Keep current master
          </Button>
          <Button onClick={restoreRevision} disabled={busy}>
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <RotateCcw size={16} />
            )}
            Restore as new revision
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
