# Reshi Resume Studio

A private, single-user resume workspace for Reshikanth Kammila. The application imports your existing DOCX once, stores structured content in SQLite, and opens directly into the saved master on later visits. Your original DOCX and PDF are copied unchanged into the ignored local data directory.

The interface uses warm white surfaces, a restrained indigo accent, subtle glass navigation, and **Segoe UI Regular (400), Semibold (600), and Bold (700)**. Name, headings, and numeric achievement metrics use Bold; selected controls and role emphasis use Semibold; body text, dates, and contacts use Regular. Windows supplies these fonts locally; other systems fall back to Arial without redistributing Microsoft's font files.

## Run locally

Requirements: Node.js 20.9+, Python 3.11+, and internet access for the initial dependency/browser installation. This checkout was verified on Windows with Node 24 and Python 3.14.

```powershell
npm ci
npm run setup
npm run studio
```

Open **http://127.0.0.1:3000**. Both servers bind to localhost. You can import your DOCX and optional reference PDF on the first screen. If a master is already saved, setup does not replace it. No API key is required.

For a production build, run `npm run build`, then `npm run studio:production`. Stop the existing studio first if it is already using ports 3000/8000. The launchers also disable Next.js CLI telemetry.

For an explicit one-time import from the command line:

```powershell
.\.venv\Scripts\python.exe -m backend.import_resume --docx "C:\path\to\your.docx" --pdf "C:\path\to\your.pdf"
```

The optional `--pdf` is for extraction comparison and visual reference. The DOCX is canonical. The import review records source paragraph/section counts, mismatches, and any marker cleanup. This checkout's personal original files were found in Downloads and imported successfully; they are deliberately excluded from Git.

To run the services separately:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
npm run dev
```

On macOS/Linux, the venv interpreter is `.venv/bin/python`. `npm run setup` and `npm run studio` select it automatically.

## What works

- Structured editing of personal details, summary, grouped skills, employers, projects, awards, certifications, and education. Stable IDs, add/remove, section visibility, section/entry/bullet ordering, session undo/redo, and debounced saving.
- An atomic revision pointer prevents a stale window from overwriting a newer edit. Saving failures remain visible, and closing a window with unsaved edits triggers a browser warning. Restoring a master revision appends a new revision.
- Live semantic HTML preview at A4 width, zoom, and preview focus mode. The preview shows continuous document flow; Chromium applies and validates final page breaks during export. It does not claim to be a pixel-identical paginated preview.
- Job-description analysis with explicit requirements, responsibilities, skill evidence, strong/partial/missing classifications, required/preferred coverage, unassessed statements, and an explained scoring formula. No-match descriptions receive no invented score.
- Evidence-backed recommendations to prioritize existing summary sentences, skills, and achievement bullets. Review, edit, approve, reject, and undo approval before creating an immutable tailored version.
- Tailored versions retain the full job description, source master revision, analysis, and approved changes. Open and compare against their actual source revision; regenerate PDFs without changing the master.
- Local ATS-readiness findings for section completeness, contacts, dates, duplicate bullets, glyphs, long bullets, and hyperlink syntax. Job-specific coverage is included for tailored versions.
- Actual A4 PDF export using Playwright/Chromium. The shared template waits for fonts, embeds selectable text and contact links, avoids browser headers, permits extra pages, and validates content completeness, order, A4 size, blank pages, page bounds, links, and replacement glyphs with PyMuPDF. A failed file is never recorded as a successful export.
- Export history with downloads and regeneration from the original revision, plus complete ZIP backup/restore. Restore checks paths and hashes and saves a recovery backup under `data/backups/` before replacing the active database.

## Privacy and optional AI

No analytics, telemetry, login, public sharing, or external calls are used by the core editor, deterministic matching, ATS checks, or PDF export. `data/`, PDFs, DOCX files, environment files, and test artifacts are ignored by Git. Runtime writes are confined to the configured data directory; initial CLI import reads only explicitly supplied files. Browser API access is restricted to local origins. This is a localhost tool, not a hardened internet-facing service.

Copy `.env.example` to `.env` to configure the data directory and optional model. Restart after changes. Never commit the environment file.

```dotenv
AI_MODE=local
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=your-installed-model
AI_API_KEY=
```

Local mode only permits loopback HTTP(S) endpoints, does not follow redirects, and ignores proxy environment variables. External mode permits an explicitly configured OpenAI-compatible endpoint. A visible checkbox on Job Match is required to send the resume and job text to that provider. API keys stay in environment variables and are never returned to the UI or backups.

AI is deliberately conservative: a proposal can select or reorder complete source statements, and cannot insert unsupported claims. New qualifications, metrics, or experience must be confirmed by editing the master first. Free-form AI paraphrasing is not accepted merely because it shares source keywords. Provider failures keep the completed local analysis and show a clear fallback message. Real external-provider credentials were not needed or tested; provider behavior is covered with mocked responses.

## Checks and practical limits

This is an explainable local matcher, not a model of any proprietary hiring system. It recognizes a maintained technology/alias vocabulary and explicitly leaves other requirements for manual review. Skills listed without applied evidence get partial credit. The score does not verify proficiency, work eligibility, compensation, or a probability of interview.

ATS checks validate hyperlink syntax and exported PDF links, not live availability of external websites. Date checks catch missing years, reverse year ranges, and future years; overlapping months and role-specific experience duration still require review. The PDF checks detect missing text, extraction order, obvious out-of-page bounds and invalid glyphs, and are supplemented by visual review; they do not guarantee every ATS will render or parse the file identically.

One shared template lives in `backend/rendering.py`. Layout is semantic and flows naturally; there are no manually positioned content boxes or forced one-page truncation. Large entries can span additional pages when needed. The master is append-only at the revision layer; restoring a whole backup restores the historical state recorded by that archive and retains the pre-restore archive for recovery.

The Windows setup currently validates Segoe UI from the installed fonts. For portable Segoe UI rendering on another OS, install appropriately licensed fonts; otherwise the documented fallback applies.

## Architecture

```text
app/                  Next.js shell, global design system, metadata
components/           Editor, preview, match, ATS, versions, exports, settings
components/ui/        shadcn-style buttons and accessible Radix dialogs
lib/                  Strict TypeScript DTOs, API client, autosave/undo state
backend/models.py     Pydantic domain/request models, stable IDs, evidence units
backend/database.py   SQLAlchemy snapshots, jobs, versions, exports, master pointer
backend/importer.py   DOCX extraction, PDF text comparison, initial evidence ledger
backend/analysis.py   Deterministic matching, recommendations, evidence gate
backend/ai.py         Optional OpenAI-compatible provider and local-only validation
backend/rendering.py  Shared HTML/CSS template for preview and PDF
backend/pdf_export.py Chromium generation and actual-file integrity checks
backend/ats.py        Explainable readiness checks and coverage findings
backend/main.py       API, local request guard, import, revisions, backup/restore
backend/migrations/   Alembic schema migrations, run automatically on startup
scripts/              Setup, launcher, visual inspection, sample export
tests/                Backend, frontend, and isolated browser workflow tests
data/                 Local originals, studio.db, exports, recovery archives (ignored)
```

API reference is available locally at **http://127.0.0.1:8000/docs**. Requests use Pydantic validation and meaningful HTTP status codes. The frontend fetches real backend records; personal resume content is never embedded in tracked source.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
.\.venv\Scripts\python.exe -m ruff check backend tests/backend
.\.venv\Scripts\python.exe -m pytest
npm run test:e2e
npm run build
```

The E2E workflow uses a synthetic DOCX/PDF and a separate temporary SQLite database, imports through the UI, edits and reloads, checks undo/redo, analyzes a role, approves a recommendation, creates a separate version, downloads and inspects its PDF, runs actual-file ATS checks, restores a backup, and checks mobile overflow. It does not modify the personal resume. Browser testing uses the Playwright Chromium installed during setup. Backend tests cover import, persistence in a new process, stale-save rejection, ledger retention, evidence rejection, version isolation, revision restore, PDF failure detection, backups, path traversal, local AI isolation, mocked AI, and HTML escaping.

Backend direct dependencies are pinned in `requirements.txt`; the verified transitive resolution is in `requirements.lock`. JavaScript resolution is committed in `package-lock.json`.

To generate a personal sample while the server is running:

```powershell
.\.venv\Scripts\python.exe scripts/export-sample.py
```

The real PDF and validation record are written to ignored `output/pdf/`. Desktop/mobile visual review captures are in ignored `output/ui/`.

## Reference inspection and design provenance

Reviewed [career-ops](https://github.com/career-ops-hq/career-ops): README, MIT license, architecture, `modes/_shared.md`, `generate-pdf.mjs`, and `verify-ats.mjs`. It is a local CLI/file-based ecosystem, not a FastAPI resume-editor foundation; this project uses the requested Next.js/FastAPI/SQLite stack and original implementations. Adopted its ideas of evidence before keywords, human approval, separating system code from personal data, and verifying generated PDFs. No upstream application source was copied.

Used the user-requested [Apple Skills](https://github.com/Prisma-Labs-Dev/apple-skills) repository's `hig` and `ios-liquid-glass` skills and the materials/sidebar references. Their facts informed accessible navigation, reduced-motion/contrast support, and limiting translucent materials to controls/navigation. The web implementation uses CSS and Lucide, rather than unsupported SwiftUI APIs. Segoe UI and the warm light theme follow the user's explicit preferences.

Both repositories are MIT licensed; Apple HIG text remains Apple's documentation. Their repositories are references, not bundled dependencies or copied assets.

### Approved logo — Exact Fit (B)

The user selected concept B from the requested [Logo Design skill](https://github.com/kaankiziltug/logo-design-skill). Its two fitted shapes represent the original and tailored résumé. The shared `components/brand-mark.tsx` renders the approved geometry in the sidebar, loading/onboarding states, and compact header. `app/icon.svg` and `app/apple-icon.png` cover browser and Apple touch icons. No logo is added to the actual résumé/PDF.

`public/brand/` contains the indigo (`#5145CD`), black, and white vector/transparent PNG variants, app/web icons, colour showcase, and `usage-guide.md`. The web manifest references those public assets; it does not add offline support or change local-only access. The mark has not received trademark clearance.

With the local app running, `node scripts/verify-brand.mjs` checks the displayed paths against the SVG master, favicon and colour asset responses, desktop/collapsed-sidebar/mobile branding, browser errors, and mobile overflow. It makes no résumé-content changes.
