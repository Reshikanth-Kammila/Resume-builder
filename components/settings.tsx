"use client";
import { useState } from "react";
import {
  Check,
  Download,
  FolderLock,
  HardDrive,
  Info,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Type,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ImportReport, Settings } from "@/lib/types";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

export function StudioSettings({
  settings,
  report,
  notify,
  onRestored,
  onReview,
}: {
  settings: Settings | null;
  report: ImportReport | null;
  notify: (message: string, error?: boolean) => void;
  onRestored: () => Promise<void>;
  onReview: () => void;
}) {
  const [restore, setRestore] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const restoreBackup = async () => {
    if (!restore) return;
    setBusy(true);
    try {
      const data = new FormData();
      data.append("file", restore);
      const result = await api<{ restored: boolean; recovery_backup: string }>(
        "/backup/restore",
        { method: "POST", body: data },
      );
      setRestore(null);
      await onRestored();
      notify(
        `Backup restored. Your prior state is retained as ${result.recovery_backup}.`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Restore failed.", true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-content settings-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">YOUR WORKSPACE. YOUR CONTROL.</span>
          <h1>A little peace of mind.</h1>
          <p>
            A personal studio, designed around your privacy and preferences.
          </p>
        </div>
        <span className="badge badge-green">
          <LockKeyhole size={13} />
          Local only
        </span>
      </div>
      <div className="settings-grid">
        <section className="surface settings-section">
          <div className="surface-heading">
            <span className="feature-icon">
              <FolderLock size={20} />
            </span>
            <div>
              <h2>Private by design</h2>
              <p>Your resume stays close to home.</p>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Storage</strong>
              <p>Resume, revisions, and PDFs are saved on this device.</p>
            </div>
            <span className="badge badge-green">
              <Check size={12} />
              Local
            </span>
          </div>
          <div className="setting-row">
            <div>
              <strong>Analytics & telemetry</strong>
              <p>No tracking or usage reporting.</p>
            </div>
            <span className="setting-value">Off</span>
          </div>
          <div className="setting-row">
            <div>
              <strong>Accounts & sharing</strong>
              <p>A personal workspace. No registration or public links.</p>
            </div>
            <ShieldCheck size={19} />
          </div>
          <div className="storage-path">
            <HardDrive size={15} />
            <span>{settings?.data_directory || "Loading local storage…"}</span>
          </div>
        </section>
        <section className="surface settings-section typography-settings">
          <div className="surface-heading">
            <span className="feature-icon">
              <Type size={20} />
            </span>
            <div>
              <h2>A clear hierarchy</h2>
              <p>Segoe UI, through every detail.</p>
            </div>
          </div>
          <div className="font-sample bold">
            <span>Aa</span>
            <div>
              <strong>Segoe UI Bold</strong>
              <p>Your name, headings, and key metrics</p>
            </div>
            <code>700</code>
          </div>
          <div className="font-sample semibold">
            <span>Aa</span>
            <div>
              <strong>Segoe UI Semibold</strong>
              <p>Selected titles and emphasis</p>
            </div>
            <code>600</code>
          </div>
          <div className="font-sample regular">
            <span>Aa</span>
            <div>
              <strong>Segoe UI Regular</strong>
              <p>Body text, dates, and contact details</p>
            </div>
            <code>400</code>
          </div>
        </section>
        <section className="surface settings-section">
          <div className="surface-heading">
            <span className="feature-icon">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2>Optional AI assistance</h2>
              <p>Helpful when you choose it.</p>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Provider mode</strong>
              <p>
                {settings?.ai.mode === "external"
                  ? "External provider"
                  : settings?.ai.mode === "local"
                    ? "Model on this device"
                    : "Local analysis only — no AI provider"}
              </p>
            </div>
            <span
              className={`badge ${settings?.ai.configured ? "badge-indigo" : "badge-gray"}`}
            >
              {settings?.ai.configured ? "Configured" : "Disabled"}
            </span>
          </div>
          {settings?.ai.configured && (
            <div className="provider-details">
              <span>Model: {settings.ai.model}</span>
              <span>Endpoint: {settings.ai.base_url}</span>
            </div>
          )}
          <p className="small-note">{settings?.ai.privacy}</p>
          <details className="method-details">
            <summary>Configure a provider</summary>
            <p>
              Set AI_MODE, AI_BASE_URL, AI_MODEL, and AI_API_KEY in the local
              .env file, then restart the studio. Local mode permits only
              loopback endpoints. Editing, matching, ATS checks, and PDF exports
              work without a key.
            </p>
            <p>
              To keep suggestions traceable, AI can select and reorder complete
              source statements. Add newly confirmed facts to the master before
              using them in a tailored version.
            </p>
          </details>
        </section>
        <section className="surface settings-section">
          <div className="surface-heading">
            <span className="feature-icon">
              <HardDrive size={20} />
            </span>
            <div>
              <h2>Keep a safe copy</h2>
              <p>A backup of your whole studio.</p>
            </div>
          </div>
          <p className="settings-copy">
            Save your resume, revision history, job analyses, tailored versions,
            original files, and exported PDFs in one local archive.
          </p>
          <div className="backup-actions">
            <a className="button button-outline" href="/api/backup" download>
              <Download size={16} />
              Download backup
            </a>
            <label className="button button-ghost file-button">
              <Upload size={16} />
              Restore backup
              <input
                type="file"
                accept=".zip"
                onChange={(e) => {
                  setRestore(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="small-note">
            <Info size={13} />
            Your current studio is backed up before a restore.
          </p>
        </section>
        <section className="surface settings-section import-setting">
          <div className="surface-heading">
            <span className="feature-icon">
              <Upload size={20} />
            </span>
            <div>
              <h2>Your original resume</h2>
              <p>Preserved, just as you supplied it.</p>
            </div>
          </div>
          {report ? (
            <>
              <div className="setting-row">
                <div>
                  <strong>{report.docx_filename}</strong>
                  <p>
                    Canonical content · {report.section_count} sections imported
                  </p>
                </div>
                <span
                  className={`badge ${report.reviewed ? "badge-green" : "badge-amber"}`}
                >
                  {report.reviewed ? "Reviewed" : "Review import"}
                </span>
              </div>
              <div className="backup-actions">
                <Button variant="outline" onClick={onReview}>
                  Review import
                </Button>
                <a
                  className="button button-ghost"
                  href="/api/import/original/docx"
                  download
                >
                  <Download size={15} />
                  Original DOCX
                </a>
                {report.pdf_filename && (
                  <a
                    className="button button-ghost"
                    href="/api/import/original/pdf"
                    download
                  >
                    <Download size={15} />
                    Original PDF
                  </a>
                )}
              </div>
            </>
          ) : (
            <p>No original files imported yet.</p>
          )}
        </section>
      </div>
      <Dialog
        open={!!restore}
        onOpenChange={(open) => {
          if (!open) setRestore(null);
        }}
        title="Restore your studio?"
        description="This replaces the active local studio with the selected backup. A recovery backup of your current state is saved first."
      >
        <div className="notice">
          <HardDrive size={18} />
          {restore?.name}
        </div>
        <div className="dialog-footer">
          <Button variant="outline" onClick={() => setRestore(null)}>
            Keep current studio
          </Button>
          <Button onClick={restoreBackup} disabled={busy}>
            {busy ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <Upload size={16} />
            )}
            Restore backup
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
