"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  GitBranch,
  Loader2,
  LockKeyhole,
  Menu,
  PanelLeftClose,
  Redo2,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { api, ApiError, post } from "@/lib/api";
import type {
  Export,
  ImportReport,
  Master,
  Screen,
  Settings,
  Version,
} from "@/lib/types";
import { useResume } from "@/lib/use-resume";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ResumeEditor } from "@/components/resume-editor";
import { BrandMark } from "@/components/brand-mark";
import { ResumePreview } from "@/components/resume-preview";
import { JobMatch } from "@/components/job-match";
import { AtsAnalysis } from "@/components/ats-analysis";
import { Versions } from "@/components/versions";
import { ExportHistory } from "@/components/export-history";
import { StudioSettings } from "@/components/settings";

const nav: { id: Screen; label: string; icon: typeof FileText }[] = [
  { id: "resume", label: "My Resume", icon: FileText },
  { id: "match", label: "Job Match", icon: Target },
  { id: "ats", label: "ATS Analysis", icon: ShieldCheck },
  { id: "versions", label: "Resume Versions", icon: GitBranch },
  { id: "exports", label: "Export History", icon: Clock3 },
  { id: "settings", label: "Settings", icon: Settings2 },
];
export default function Studio() {
  const [screen, setScreen] = useState<Screen>("resume");
  const [sidebar, setSidebar] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [focus, setFocus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [review, setReview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [latestExport, setLatestExport] = useState<Export | null>(null);
  const [initialVersion, setInitialVersion] = useState<Version | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string, error = false) => {
    setToast({ message, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 10000 : 5500);
  }, []);
  const onSaveError = useCallback(
    (message: string) => notify(message, true),
    [notify],
  );
  const editor = useResume(onSaveError);
  const { load, flush } = editor;
  const boot = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await api<Master>("/master");
      load(result);
      const [preferences, importResult] = await Promise.all([
        api<Settings>("/settings"),
        api<ImportReport | null>("/import/report"),
      ]);
      setSettings(preferences);
      setReport(importResult);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setSettings(await api<Settings>("/settings").catch(() => null));
      } else
        setLoadError(
          error instanceof Error ? error.message : "Could not open the studio.",
        );
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Bootstrap an asynchronous API read with loading and failure states.
    void boot();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [boot]);
  const navigate = async (next: Screen) => {
    try {
      await flush();
      setScreen(next);
      setMobileNav(false);
      setInitialVersion(null);
    } catch {
      /* Save error is already visible. */
    }
  };
  const exportPdf = useCallback(
    async (versionId?: string, revisionId?: number) => {
      if (exporting) return;
      setExporting(true);
      try {
        await flush();
        const result = await post<Export>("/exports", {
          version_id: versionId || null,
          revision_id: revisionId || null,
        });
        setLatestExport(result);
        const response = await fetch(`/api/exports/${result.id}/download`);
        if (!response.ok)
          throw new Error(
            "PDF was generated but could not be downloaded. Reopen it from Export History.",
          );
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = result.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        notify(
          `Your ${result.validation.pages}-page A4 PDF is validated and downloaded.`,
        );
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "PDF export failed.",
          true,
        );
      } finally {
        setExporting(false);
      }
    },
    [exporting, flush, notify],
  );
  const importResume = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setImportBusy(true);
    try {
      const result = await api<Master>("/import", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      load(result);
      setReport(await api<ImportReport>("/import/report"));
      notify("Your resume is imported. Review the original comparison.");
      setReview(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Import failed.", true);
    } finally {
      setImportBusy(false);
    }
  };
  const name = editor.resume?.name || "Reshi";
  const initials = name
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  const currentNav = nav.find((n) => n.id === screen)!;
  return (
    <div
      className={`studio-shell ${!sidebar ? "sidebar-collapsed" : ""} ${mobileNav ? "mobile-nav-open" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => void navigate("resume")}
          aria-label="Reshi Resume Studio home"
        >
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span>
            Reshi<span>RESUME STUDIO</span>
          </span>
        </button>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              className={`nav-item ${screen === id ? "active" : ""} ${i === 5 ? "nav-settings" : ""}`}
              aria-current={screen === id ? "page" : undefined}
              onClick={() => void navigate(id)}
            >
              <Icon size={19} strokeWidth={screen === id ? 2 : 1.7} />
              <span>{label}</span>
              {screen === id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="local-lock">
              <LockKeyhole size={18} />
            </span>
            <strong>A space that’s yours.</strong>
            <p>
              Your resume. Your device.
              <br />
              Your next chapter.
            </p>
            <span className="local-status">
              <span className="live-dot" />
              Stored locally
            </span>
          </div>
          <button
            className="user-profile"
            onClick={() => void navigate("settings")}
          >
            <span className="user-avatar">{initials}</span>
            <span>
              <strong>{name.split(" ")[0]}</strong>
              <small>Personal workspace</small>
            </span>
            <ChevronRight size={15} />
          </button>
        </div>
      </aside>
      <main className="main-shell" id="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="desktop-sidebar-toggle"
              aria-label={sidebar ? "Hide sidebar" : "Show sidebar"}
              onClick={() => setSidebar(!sidebar)}
            >
              <PanelLeftClose size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </Button>
            <BrandMark className="breadcrumb-brand" />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{currentNav.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="privacy-indicator">
              <LockKeyhole size={13} />
              Private & local
            </span>
            <span className="topbar-avatar">{initials}</span>
          </div>
        </header>
        {loading ? (
          <div className="studio-loading">
            <div className="brand-mark">
              <BrandMark />
            </div>
            <Loader2 size={23} className="spin" />
            <p>Opening your studio…</p>
          </div>
        ) : loadError ? (
          <div className="empty-state app-error">
            <CircleAlert size={35} />
            <h1>Let’s reconnect your studio.</h1>
            <p>{loadError}</p>
            <Button onClick={boot}>Try again</Button>
          </div>
        ) : !editor.resume ? (
          <div className="onboarding">
            <div className="onboarding-mark brand-mark">
              <BrandMark />
            </div>
            <span className="eyebrow">WELCOME TO YOUR PERSONAL STUDIO</span>
            <h1>
              A new space for
              <br />
              your next chapter.
            </h1>
            <p>
              Bring your existing resume. We’ll keep the content intact
              <br />
              and give you a beautiful place to work on it.
            </p>
            <form className="surface import-form" onSubmit={importResume}>
              <label className="import-file">
                <Upload size={24} />
                <strong>Your resume DOCX</strong>
                <span>Canonical source for your content</span>
                <input type="file" name="docx" accept=".docx" required />
              </label>
              <label className="import-file">
                <FileText size={24} />
                <strong>Reference PDF (optional)</strong>
                <span>Compare extracted content with the original</span>
                <input type="file" name="pdf" accept=".pdf" />
              </label>
              <Button type="submit" disabled={importBusy}>
                {importBusy ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <ArrowRight size={16} />
                )}
                Import my resume
              </Button>
            </form>
            <span className="privacy-footnote">
              <ShieldCheck size={15} />
              Original files are preserved. Everything stays local.
            </span>
          </div>
        ) : (
          <>
            {screen === "resume" && (
              <>
                <section className="resume-heading">
                  <div>
                    <div className="heading-kicker">
                      <span className="eyebrow">
                        YOUR NEXT CHAPTER STARTS HERE
                      </span>
                      <span className="badge badge-indigo">
                        <GitBranch size={11} />
                        Master resume
                      </span>
                    </div>
                    <h1>
                      My resume<span className="heading-period">.</span>
                    </h1>
                    <p>Your experience, thoughtfully presented.</p>
                  </div>
                  <div className="resume-heading-actions">
                    <span
                      className={`save-indicator ${editor.saveState}`}
                      aria-live="polite"
                    >
                      {editor.saveState === "saved" ? (
                        <Check size={14} />
                      ) : editor.saveState === "saving" ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <CircleAlert size={14} />
                      )}{" "}
                      {editor.saveState === "saved"
                        ? "All changes saved"
                        : editor.saveState === "saving"
                          ? "Saving…"
                          : editor.saveState === "error"
                            ? "Save failed"
                            : "Unsaved changes"}
                    </span>
                    <Button onClick={() => exportPdf()} disabled={exporting}>
                      {exporting ? (
                        <Loader2 size={16} className="spin" />
                      ) : (
                        <Download size={16} />
                      )}{" "}
                      {exporting ? "Validating PDF…" : "Download PDF"}
                    </Button>
                  </div>
                </section>
                {report && !report.reviewed && (
                  <div className="import-review-banner">
                    <span>
                      <FileCheck2 size={17} />
                      Your original resume is imported.{" "}
                      {report.differences.length
                        ? `${report.differences.length} items need review.`
                        : "All extracted content matches the reference PDF."}
                    </span>
                    <button onClick={() => setReview(true)}>
                      Review import
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
                <div className="resume-workbar">
                  <div className="segmented">
                    <button
                      className={!focus ? "selected" : ""}
                      onClick={() => setFocus(false)}
                    >
                      <FileText size={14} />
                      Edit & preview
                    </button>
                    <button
                      className={focus ? "selected" : ""}
                      onClick={() => setFocus(true)}
                    >
                      <FileCheck2 size={14} />
                      Preview only
                    </button>
                  </div>
                  <div className="workbar-tools">
                    <span className="revision-label">
                      Revision {editor.revision}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Undo edit"
                      disabled={!editor.history.undo}
                      onClick={editor.undo}
                    >
                      <Undo2 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Redo edit"
                      disabled={!editor.history.redo}
                      onClick={editor.redo}
                    >
                      <Redo2 size={16} />
                    </Button>
                    {editor.saveState === "error" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void flush().catch(() => undefined)}
                      >
                        Retry save
                      </Button>
                    )}
                  </div>
                </div>
                <div
                  className={`resume-workspace ${focus ? "focus-mode" : ""}`}
                >
                  {!focus && (
                    <ResumeEditor
                      resume={editor.resume}
                      update={editor.update}
                    />
                  )}
                  <ResumePreview
                    resume={editor.resume}
                    focus={focus}
                    onToggleFocus={() => setFocus(!focus)}
                  />
                </div>
                <footer className="workspace-footer">
                  <span>
                    <ShieldCheck size={13} />
                    Original content. Intentional changes.
                  </span>
                  <button
                    className="text-button"
                    onClick={() => void navigate("match")}
                  >
                    <Sparkles size={13} />
                    Tailor for your next opportunity
                    <ArrowRight size={13} />
                  </button>
                  {latestExport && (
                    <span className="latest-export">
                      Last export: {latestExport.validation.pages} pages ·
                      Validated
                    </span>
                  )}
                </footer>
              </>
            )}
            {screen === "match" && (
              <JobMatch
                settings={settings}
                flush={flush}
                notify={notify}
                onVersion={(v) => {
                  setInitialVersion(v);
                  setScreen("versions");
                }}
              />
            )}
            {screen === "ats" && (
              <AtsAnalysis
                flush={flush}
                notify={notify}
                exportPdf={exportPdf}
              />
            )}
            {screen === "versions" && (
              <Versions
                notify={notify}
                flush={flush}
                onRestore={load}
                exportPdf={exportPdf}
                initialVersion={initialVersion}
                onMatch={() => void navigate("match")}
              />
            )}
            {screen === "exports" && (
              <ExportHistory
                notify={notify}
                exportPdf={exportPdf}
                onResume={() => void navigate("resume")}
              />
            )}
            {screen === "settings" && (
              <StudioSettings
                settings={settings}
                report={report}
                notify={notify}
                onRestored={boot}
                onReview={() => setReview(true)}
              />
            )}
          </>
        )}
      </main>
      <Dialog
        open={review}
        onOpenChange={setReview}
        title="Your original, faithfully imported"
        description="DOCX supplies the content. PDF extraction provides an independent comparison."
        wide
      >
        {report && (
          <>
            <div className="import-report-summary">
              <span className="feature-icon">
                <FileCheck2 size={25} />
              </span>
              <div>
                <h3>
                  {report.differences.length
                    ? `${report.differences.length} content items to review`
                    : "All extracted content found in the reference PDF"}
                </h3>
                <p>
                  {report.paragraph_count} source paragraphs ·{" "}
                  {report.section_count} sections · {report.pdf_pages ?? "No"}{" "}
                  reference pages
                </p>
              </div>
            </div>
            {report.warnings.map((warning, i) => (
              <div className="notice" key={i}>
                <CircleAlert size={17} />
                {warning}
              </div>
            ))}
            {report.differences.length > 0 && (
              <div className="import-differences">
                {report.differences.map((d, i) => (
                  <div key={i}>
                    <strong>{d.reason}</strong>
                    <p>{d.docx_text}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="import-comparison">
              <div>
                <label>CANONICAL DOCX</label>
                <p>{report.docx_filename}</p>
                <a
                  className="button button-outline button-sm"
                  href="/api/import/original/docx"
                  download
                >
                  <Download size={14} />
                  Original DOCX
                </a>
              </div>
              <div>
                <label>REFERENCE PDF</label>
                <p>{report.pdf_filename || "Not supplied"}</p>
                {report.pdf_filename && (
                  <a
                    className="button button-outline button-sm"
                    href="/api/import/original/pdf"
                    download
                  >
                    <Download size={14} />
                    Original PDF
                  </a>
                )}
              </div>
            </div>
            <p className="small-note">
              Text matching normalizes spacing and bullet markers. It does not
              certify visual identity. You can review and edit every imported
              field in the editor.
            </p>
            <div className="dialog-footer">
              <Button
                onClick={async () => {
                  try {
                    setReport(await post<ImportReport>("/import/review"));
                    setReview(false);
                    notify("Import reviewed. Your originals remain unchanged.");
                  } catch (error) {
                    notify(
                      error instanceof Error
                        ? error.message
                        : "Could not record review.",
                      true,
                    );
                  }
                }}
              >
                <Check size={16} />
                Mark import reviewed
              </Button>
            </div>
          </>
        )}
      </Dialog>
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleAlert size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {exporting && screen !== "resume" && (
        <div className="export-progress" role="status">
          <Loader2 className="spin" size={16} />
          Generating and validating your PDF…
        </div>
      )}
    </div>
  );
}
