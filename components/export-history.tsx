"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Download,
  FileCheck2,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { api, dateLabel } from "@/lib/api";
import type { Export } from "@/lib/types";
import { Button } from "./ui/button";

export function ExportHistory({
  notify,
  exportPdf,
  onResume,
}: {
  notify: (message: string, error?: boolean) => void;
  exportPdf: (versionId?: string, revisionId?: number) => Promise<void>;
  onResume: () => void;
}) {
  const [exports, setExports] = useState<Export[] | null>(null);
  const refresh = useCallback(async () => {
    try {
      setExports(await api<Export[]>("/exports"));
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not load exports.",
        true,
      );
    }
  }, [notify]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load persisted exports asynchronously, not derived render state.
    void refresh();
  }, [refresh]);
  return (
    <div className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">THE FINISHED DETAILS</span>
          <h1>Made to leave an impression.</h1>
          <p>Every exported PDF, validated and ready when you need it.</p>
        </div>
        <Button
          onClick={async () => {
            await exportPdf();
            await refresh();
          }}
        >
          <Download size={16} />
          Export master PDF
        </Button>
      </div>
      {exports?.length ? (
        <div className="surface export-list">
          <div className="table-header">
            <span>DOCUMENT</span>
            <span>DETAILS</span>
            <span>EXPORTED</span>
            <span>ACTIONS</span>
          </div>
          {exports.map((e) => (
            <div className="export-row" key={e.id}>
              <div className="export-name">
                <span className="file-icon">
                  <FileText size={21} />
                </span>
                <div>
                  <strong>{e.filename}</strong>
                  <small>
                    {e.version_id ? "Tailored version" : "Master resume"} ·
                    Revision {e.revision_id}
                  </small>
                </div>
              </div>
              <div className="export-details">
                <span className="badge badge-green">
                  <ShieldCheck size={12} />
                  Validated
                </span>
                <small>A4 · {e.validation.pages} pages · Selectable text</small>
              </div>
              <span className="export-date">{dateLabel(e.created_at)}</span>
              <div className="export-actions">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Regenerate ${e.filename}`}
                  onClick={async () => {
                    await exportPdf(
                      e.version_id || undefined,
                      e.version_id ? undefined : e.revision_id,
                    );
                    await refresh();
                  }}
                >
                  <RefreshCw size={16} />
                </Button>
                <a
                  className="button button-outline button-sm"
                  href={`/api/exports/${e.id}/download`}
                  download
                >
                  <Download size={15} />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state surface generous">
          <div className="empty-art">
            <FileCheck2 size={40} strokeWidth={1.4} />
          </div>
          <h2>Your next chapter, on paper.</h2>
          <p>
            Export your resume as a real, selectable A4 PDF.
            <br />
            We verify the file before calling it finished.
          </p>
          <Button onClick={onResume}>
            Back to your resume
            <ArrowRight size={16} />
          </Button>
        </div>
      )}
      <p className="privacy-footnote">
        <ShieldCheck size={14} />
        PDFs stay in your local data directory. Every export retains its source
        revision.
      </p>
    </div>
  );
}
