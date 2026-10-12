import { XMLParser } from "fast-xml-parser";
import type { Domain } from "../types";

export type RawPaper = {
  external_id: string;
  title: string;
  abstract: string | null;
  url: string;
  authors: string[];
  published_at: string | null;
  arxiv_id?: string | null;
  doi?: string | null;
};

const ENDPOINT = "http://export.arxiv.org/api/query";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const arr = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

/** "2410.01234v2" or "http://arxiv.org/abs/2410.01234v2" -> "2410.01234" */
export function arxivBaseId(idOrUrl: string): string {
  const m = idOrUrl.match(/(\d{4}\.\d{4,5}|[a-z\-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?/i);
  return m ? m[1] : idOrUrl;
}

function parseFeed(xml: string): RawPaper[] {
  const doc = parser.parse(xml);
  return arr(doc?.feed?.entry).map((e: Record<string, unknown>) => {
    const idUrl = String(e.id ?? "");
    const base = arxivBaseId(idUrl);
    return {
      external_id: base,
      arxiv_id: base,
      title: clean(String(e.title ?? "")),
      abstract: clean(String(e.summary ?? "")) || null,
      url: `https://arxiv.org/abs/${base}`,
      authors: arr(e.author as { name: string } | { name: string }[]).map((a) => clean(String(a.name))),
      published_at: e.published ? new Date(String(e.published)).toISOString() : null,
      doi: (e["arxiv:doi"] as string | undefined) ?? null,
    };
  });
}

function buildQuery(d: Domain): string {
  const kw = d.keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => (k.includes(" ") ? `all:"${k.replace(/"/g, "")}"` : `all:${k}`));
  let q = `(${kw.join(" OR ")})`;
  if (d.arxiv_categories.length) q += ` AND (${d.arxiv_categories.map((c) => `cat:${c}`).join(" OR ")})`;
  return q;
}

export async function fetchArxiv(d: Domain): Promise<RawPaper[]> {
  if (!d.keywords.length) return [];
  const params = new URLSearchParams({
    search_query: buildQuery(d),
    sortBy: "submittedDate",
    sortOrder: "descending",
    start: "0",
    max_results: "50",
  });
  const res = await fetch(`${ENDPOINT}?${params}`, { headers: { "User-Agent": "ResearchPulse/1.0" } });
  if (!res.ok) throw new Error(`arXiv returned ${res.status}.`);
  return parseFeed(await res.text());
}

/** Confirms each ID resolves to a real arXiv record. Returns the set of IDs that exist. */
export async function validateArxivIds(ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (!ids.length) return found;
  const params = new URLSearchParams({ id_list: ids.join(","), max_results: String(ids.length) });
  const res = await fetch(`${ENDPOINT}?${params}`, { headers: { "User-Agent": "ResearchPulse/1.0" } });
  if (!res.ok) throw new Error(`arXiv lookup returned ${res.status}.`);
  for (const p of parseFeed(await res.text())) {
    // arXiv returns an "Error" entry for unknown IDs; it has no title-bearing abs URL.
    if (p.title && !/^error$/i.test(p.title)) found.add(p.external_id);
  }
  return found;
}
