export type Source = "arxiv" | "semantic_scholar" | "google_scholar";
export const SOURCES: Source[] = ["arxiv", "semantic_scholar", "google_scholar"];
export const SOURCE_LABEL: Record<Source | "news", string> = {
  arxiv: "arXiv",
  semantic_scholar: "Semantic Scholar",
  google_scholar: "Google Scholar",
  news: "Google News",
};

export type Topic = {
  id: string;
  name: string;
  keywords: string[];
  arxiv_categories: string[];
  active: boolean;
  created_at: string;
};

export type Domain = { name: string; keywords: string[]; arxiv_categories: string[] };

export type FetchState = {
  status: "pending" | "running" | "done" | "failed" | "timed_out" | "skipped";
  fetched: number;
  kept: number;
  gated_old: number;
  gated_seen: number;
  error?: string;
  apify_run_id?: string;
  started_at?: string;
};

export type RunProgress = {
  fetch?: Record<string, Record<string, FetchState>>; // source -> domain -> state
  score?: { total: number; done: number };
  select?: { featured: number; runner_up: number; quiet: string[] };
  write?: { total: number; done: number; news: "pending" | "done" | "none" | "failed"; validated: boolean };
  deliver?: { pdf: boolean; email: "pending" | "sent" | "skipped" | "failed"; email_error?: string };
};

export type Run = {
  id: string;
  status: string;
  step: string;
  progress: RunProgress;
  log: { at: string; msg: string }[];
  domains: Domain[];
  started_at: string;
  finished_at: string | null;
  word_count: number | null;
  read_minutes: number | null;
  emailed_at: string | null;
  error: string | null;
};

export type Paper = {
  id: string;
  run_id: string;
  source: Source;
  external_id: string;
  title: string;
  abstract: string | null;
  url: string;
  authors: string[];
  published_at: string | null;
  domains: string[];
  dup_of: string | null;
  norm_key: string | null;
};

export type Verdict = "READ IN FULL" | "FLAG FOR A CLIENT" | "KNOW IT EXISTS";
