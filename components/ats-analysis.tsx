"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleCheck,
  FileCheck2,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { api, post } from "@/lib/api";
import type { ATSReport, Version } from "@/lib/types";
import { Button } from "./ui/button";
import { Score } from "./job-match";

export function AtsAnalysis({
  flush,
  notify,
  exportPdf,
}: {
  flush: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  exportPdf: (versionId?: string) => Promise<void>;
}) {
  const [report, setReport] = useState<ATSReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionId, setVersionId] = useState("");
  const [filter, setFilter] = useState("all");
  const run = useCallback(
    async (version?: string) => {
      setBusy(true);
      try {
        await flush();
        setReport(
          await post<ATSReport>("/ats", { version_id: version || null }),
        );
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "ATS checks failed.",
          true,
        );
      } finally {
        setBusy(false);
      }
    },
    [flush, notify],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Run asynchronous server checks on first opening this screen.
    void run();
    void api<Version[]>("/versions")
      .then(setVersions)
      .catch((e) => notify(e.message, true));
  }, [run, notify]);
  const warnings =
    report?.findings.filter((f) => f.status !== "passed").length || 0;
  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">CLARITY BEFORE YOU APPLY</span>
          <h1>Ready to be read.</h1>
          <p>A careful look at how your resume travels from page to parser.</p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => run(versionId)}
        >
          {busy ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Run checks
        </Button>
      </div>
      <div className="analysis-selector">
        <label htmlFor="ats-version">Analyzing</label>
        <select
          id="ats-version"
          value={versionId}
          onChange={(e) => {
            setVersionId(e.target.value);
            void run(e.target.value);
          }}
        >
          <option value="">Master resume</option>
          {versions.map((v) => (
            <option value={v.id} key={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <span>
          <ShieldCheck size={14} />
          Deterministic, local checks
        </span>
      </div>
      {busy && !report ? (
        <div className="empty-state surface">
          <Loader2 size={30} className="spin" />
          <h3>Checking the details</h3>
          <p>Reading structure, content, and available exports.</p>
        </div>
      ) : (
        report && (
          <>
            <div className="ats-overview surface">
              <Score
                value={report.score}
                label={report.score >= 85 ? "Looking good" : "Room to refine"}
                large
              />
              <div className="ats-summary">
                <h2>
                  {warnings
                    ? `${warnings} ${warnings === 1 ? "detail" : "details"} to review`
                    : "All evaluated checks passed"}
                </h2>
                <p>
                  {report.pdf
                    ? `The actual ${report.pdf.pages}-page PDF was inspected alongside the approved resume.`
                    : "Content checks are complete. Export your PDF to check the final file."}
                </p>
                <span
                  className={`badge ${report.pdf ? "badge-green" : "badge-amber"}`}
                >
                  <FileCheck2 size={13} />
                  {report.pdf ? "PDF verified" : "PDF validation pending"}
                </span>
              </div>
            </div>
            <div className="category-bars surface">
              {report.categories.map((c) => (
                <div className="category-bar" key={c.name}>
                  <div>
                    <span>{c.name}</span>
                    <strong>
                      {c.score ?? "—"}
                      {c.score !== null && "%"}
                    </strong>
                  </div>
                  <div className="bar-track">
                    <span style={{ width: `${c.score || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {!report.pdf && (
              <div className="export-callout">
                <span className="feature-icon">
                  <FileCheck2 size={21} />
                </span>
                <div>
                  <h3>One final check, on the real file.</h3>
                  <p>
                    Export to verify A4 dimensions, selectable text, reading
                    order, and content completeness.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await exportPdf(versionId || undefined);
                    await run(versionId);
                  }}
                >
                  Export & validate
                  <ArrowRight size={15} />
                </Button>
              </div>
            )}
            <div className="coverage-heading">
              <h2>Every finding, explained</h2>
              <div className="segmented small">
                <button
                  className={filter === "all" ? "selected" : ""}
                  onClick={() => setFilter("all")}
                >
                  All checks
                </button>
                <button
                  className={filter === "review" ? "selected" : ""}
                  onClick={() => setFilter("review")}
                >
                  To review
                </button>
              </div>
            </div>
            <div className="surface findings-list">
              {report.findings
                .filter((f) => filter === "all" || f.status !== "passed")
                .map((f, i) => (
                  <div className="finding" key={i}>
                    <span className={`finding-icon ${f.status}`}>
                      {f.status === "passed" ? (
                        <Check size={17} />
                      ) : f.status === "warning" ? (
                        <TriangleAlert size={17} />
                      ) : (
                        <Info size={17} />
                      )}
                    </span>
                    <div>
                      <span className="finding-category">{f.category}</span>
                      <h3>{f.title}</h3>
                      <p>{f.detail}</p>
                      {f.fix && <p className="finding-fix">{f.fix}</p>}
                    </div>
                    <span
                      className={`badge ${f.status === "passed" ? "badge-green" : f.status === "warning" ? "badge-amber" : "badge-gray"}`}
                    >
                      {f.status === "passed"
                        ? "Passed"
                        : f.status === "warning"
                          ? "Review"
                          : "Not checked"}
                    </span>
                  </div>
                ))}
              {filter === "review" && !warnings && (
                <div className="empty-state">
                  <CircleCheck size={30} />
                  <h3>No open findings</h3>
                </div>
              )}
            </div>
            <p className="disclaimer">
              <Info size={14} />
              {report.disclaimer}
            </p>
          </>
        )
      )}
    </div>
  );
}
