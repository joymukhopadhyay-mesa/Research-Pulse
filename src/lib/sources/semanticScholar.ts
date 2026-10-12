import type { Domain } from "../types";
import type { RawPaper } from "./arxiv";

/**
 * Semantic Scholar bulk search: one call per domain, keywords OR'd together, newest first.
 * The keyless API shares a rate-limited pool, so 429s are retried within a time budget
 * that keeps the request well inside a short serverless function limit.
 */
const ENDPOINT = "https://api.semanticscholar.org/graph/v1/paper/search/bulk";
const FIELDS = "title,abstract,url,year,publicationDate,authors,externalIds";
const MAX_PAPERS = 50;
const BUDGET_MS = 35_000;

type S2Paper = {
  paperId: string;
  title: string;
  abstract: string | null;
  url: string;
  publicationDate: string | null;
  authors: { name: string }[];
  externalIds?: { ArXiv?: string; DOI?: string } | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildQuery(keywords: string[]) {
  return keywords
    .map((k) => k.replace(/["|+\-()*~]/g, " ").trim())
    .filter(Boolean)
    .map((k) => `"${k}"`)
    .join(" | ");
}

export async function fetchSemanticScholar(d: Domain, since: Date): Promise<{ papers: RawPaper[]; errors: string[] }> {
  const params = new URLSearchParams({
    query: buildQuery(d.keywords),
    fields: FIELDS,
    publicationDateOrYear: `${since.toISOString().slice(0, 10)}:`,
    sort: "publicationDate:desc",
  });
  const started = Date.now();
  let data: S2Paper[] | null = null;
  for (let attempt = 0; data === null; attempt++) {
    const res = await fetch(`${ENDPOINT}?${params}`, { headers: { "User-Agent": "ResearchPulse/1.0" } });
    if (res.status === 429) {
      const wait = 5000 * (attempt + 1);
      if (Date.now() - started + wait > BUDGET_MS) {
        throw new Error("Semantic Scholar's shared rate limit (429) did not clear in time. The other sources were used.");
      }
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`Semantic Scholar returned ${res.status}.`);
    data = ((await res.json()).data ?? []) as S2Paper[];
  }

  // G3: only papers dated inside the last 7 days. Future issue dates cannot be confirmed as new.
  const latest = Date.now() + 864e5;
  const papers = data
    .filter((p) => p.title && p.url && p.publicationDate)
    .filter((p) => {
      const t = Date.parse(p.publicationDate!);
      return t >= since.getTime() && t <= latest;
    })
    .slice(0, MAX_PAPERS)
    .map((p) => ({
      external_id: p.paperId,
      title: p.title.trim(),
      abstract: p.abstract,
      url: p.url,
      authors: (p.authors ?? []).map((a) => a.name),
      published_at: new Date(p.publicationDate!).toISOString(),
      arxiv_id: p.externalIds?.ArXiv ?? null,
      doi: p.externalIds?.DOI ?? null,
    }));
  return { papers, errors: [] };
}
