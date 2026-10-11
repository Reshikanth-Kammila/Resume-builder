export type Bullet = { id: string; text: string };
export type Entry = {
  id: string;
  title: string;
  subtitle: string;
  dates: string;
  location: string;
  body: string;
  bullets: Bullet[];
};
export type SectionKind =
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "awards"
  | "certifications"
  | "education";
export type Section = {
  id: string;
  kind: SectionKind;
  title: string;
  visible: boolean;
  text: string;
  entries: Entry[];
};
export type Evidence = {
  text: string;
  source: string;
  source_id: string;
  revision_id: number | null;
};
export type Resume = {
  name: string;
  headline: string;
  contacts: { id: string; label: string; url: string }[];
  sections: Section[];
  ledger: Evidence[];
};
export type Master = {
  resume: Resume;
  revision_id: number;
  created_at: string;
};
export type ImportReport = {
  docx_filename: string;
  pdf_filename: string | null;
  paragraph_count: number;
  section_count: number;
  warnings: string[];
  differences: { source_id: string; docx_text: string; reason: string }[];
  reviewed: boolean;
  pdf_pages?: number;
  pdf_text?: string;
};
export type Requirement = {
  id: string;
  name: string;
  category: "required" | "preferred";
  origin: string;
  job_evidence: string;
  status: "strong" | "partial" | "missing";
  evidence: { source_id: string; text: string }[];
  explanation: string;
};
export type Suggestion = {
  id: string;
  type: "text" | "order";
  target_id: string;
  existing: string;
  proposed: string;
  reason: string;
  requirement: string;
  evidence: { source_id: string; text: string }[];
  confidence: string;
  status: "pending" | "accepted" | "rejected";
};
export type Analysis = {
  score: number | null;
  required: {
    score: number | null;
    count: number;
    strong: number;
    partial: number;
  };
  preferred: {
    score: number | null;
    count: number;
    strong: number;
    partial: number;
  };
  requirements: Requirement[];
  responsibilities: string[];
  keywords: string[];
  method: string;
  limitations: string[];
  unassessed: string[];
  ai_status?: string;
};
export type Job = {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  master_revision_id: number;
  created_at: string;
  analysis: Analysis;
  suggestions: Suggestion[];
};
export type Revision = {
  id: number;
  label: string;
  created_at: string;
  parent_id: number | null;
  snapshot?: Resume;
};
export type Version = {
  id: string;
  job_id: string;
  label: string;
  created_at: string;
  master_revision_id: number;
  snapshot: Resume;
  approved_changes: Suggestion[];
  job?: Job;
};
export type PdfValidation = {
  valid: boolean;
  pages: number;
  dimensions: number[][];
  fonts: string[];
  links: number;
  missing: { source_id: string; text: string }[];
  errors: string[];
  text_characters: number;
  selectable_text: boolean;
};
export type Export = {
  id: string;
  filename: string;
  created_at: string;
  revision_id: number;
  version_id: string | null;
  validation: PdfValidation;
  download_url?: string;
};
export type ATSReport = {
  score: number;
  categories: { name: string; score: number | null }[];
  findings: {
    category: string;
    status: "passed" | "warning" | "unchecked";
    title: string;
    detail: string;
    fix: string;
  }[];
  pdf: PdfValidation | null;
  disclaimer: string;
};
export type Settings = {
  privacy: string;
  data_directory: string;
  font: string;
  telemetry: boolean;
  ai: {
    mode: string;
    base_url: string;
    model: string;
    configured: boolean;
    privacy: string;
  };
};
export type Screen =
  | "resume"
  | "match"
  | "ats"
  | "versions"
  | "exports"
  | "settings";
