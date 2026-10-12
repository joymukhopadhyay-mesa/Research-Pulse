import type { Domain } from "../types";
import type { RawPaper } from "./arxiv";

const ENDPOINT = "https://api.semanticscholar.org/graph/v1/paper/search";
const FIELDS = "title,abstract,url,year,publicationDate,authors,externalIds";

type S2Paper = {
  paperId: string;
  title: string;
  abstract: string | null;
  url: string;
  year: number | null;
  publicationDate: string | null;
  authors: { name: string }[];
  externalIds?: { ArXiv?: string; DOI?: string } | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function search(query: string, since: string): Promise<S2Paper[]> {
  const params = new URLSearchParams({ query, fields: FIELDS, limit: "25", publicationDateOrYear: `${since}:` });
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${ENDPOINT}?${params}`, { headers: { "User-Agent": "ResearchPulse/1.0" } });
    if (res.status === 429) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`Semantic Scholar returned ${res.status}.`);
    const json = await res.json();
    return (json.data ?? []) as S2Paper[];
  }
  throw new Error("Semantic Scholar rate limit (429) persisted after 3 tries.");
}

/** One relevance search per keyword (max 4), restricted to the last 7 days, merged by paperId. */
export async function fetchSemanticScholar(d: Domain, since: Date): Promise<{ papers: RawPaper[]; errors: string[] }> {
  const sinceStr = since.toISOString().slice(0, 10);
  const byId = new Map<string, RawPaper>();
  const errors: string[] = [];
  for (const [i, kw] of d.keywords.slice(0, 4).entries()) {
    if (i > 0) await sleep(1100);
    try {
      for (const p of await search(kw, sinceStr)) {
        if (!p.title || !p.url || byId.has(p.paperId)) continue;
        byId.set(p.paperId, {
          external_id: p.paperId,
          title: p.title.trim(),
          abstract: p.abstract,
          url: p.url,
          authors: (p.authors ?? []).map((a) => a.name),
          published_at: p.publicationDate ? new Date(p.publicationDate).toISOString() : null,
          arxiv_id: p.externalIds?.ArXiv ?? null,
          doi: p.externalIds?.DOI ?? null,
        });
      }
    } catch (e) {
      errors.push(`"${kw}": ${(e as Error).message}`);
    }
  }
  if (byId.size === 0 && errors.length === Math.min(d.keywords.length, 4)) {
    throw new Error(errors.join(" "));
  }
  return { papers: [...byId.values()], errors };
}
