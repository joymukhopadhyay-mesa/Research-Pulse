import { one, q } from "./db";
import type { RawPaper } from "./sources/arxiv";
import { arxivBaseId } from "./sources/arxiv";
import type { Source } from "./types";

export function normTitle(t: string) {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cross-source identity: arXiv ID first, then DOI, then normalised title. */
export function normKey(p: RawPaper): string {
  if (p.arxiv_id) return `arxiv:${arxivBaseId(p.arxiv_id)}`;
  if (p.doi) return `doi:${p.doi.toLowerCase()}`;
  return `title:${normTitle(p.title)}`;
}

/**
 * Inserts a fetched paper for a run, merging and deduplicating:
 *  - same (run, source, external_id): add the domain to its tags
 *  - same paper already present from another source: store this row as a duplicate (kept for the link
 *    appendix) and add the domain to the canonical paper's tags
 * Returns true if the paper is new to the run.
 */
export async function upsertPaper(runId: string, source: Source, domain: string, p: RawPaper): Promise<boolean> {
  const key = normKey(p);
  // A title match can also join papers whose IDs differ across sources.
  const titleKey = `title:${normTitle(p.title)}`;
  const canonical = await one<{ id: string; source: string; external_id: string }>(
    `select id, source, external_id from papers
      where run_id = $1 and dup_of is null and (norm_key = $2 or norm_key = $3 or lower(regexp_replace(title, '[^a-zA-Z0-9 ]+', ' ', 'g')) = $4)
      limit 1`,
    [runId, key, titleKey, normTitle(p.title)],
  );
  if (canonical) {
    await q(`update papers set domains = array(select distinct unnest(domains || array[$2::text])) where id = $1`, [
      canonical.id,
      domain,
    ]);
    if (canonical.source === source && canonical.external_id === p.external_id) return false;
  }
  const inserted = await q(
    `insert into papers (run_id, source, external_id, title, abstract, url, authors, published_at, domains, norm_key, dup_of)
     values ($1,$2,$3,$4,$5,$6,$7,$8,array[$9::text],$10,$11)
     on conflict (run_id, source, external_id)
     do update set domains = array(select distinct unnest(papers.domains || excluded.domains))
     returning (xmax = 0) as inserted`,
    [runId, source, p.external_id, p.title, p.abstract, p.url, p.authors, p.published_at, domain, key, canonical?.id ?? null],
  );
  return !canonical && Boolean((inserted[0] as { inserted?: boolean } | undefined)?.inserted);
}

/** Keys of papers that already featured in an earlier brief (rubric G3, checked by code). */
export async function previouslyFeaturedKeys(runId: string): Promise<Set<string>> {
  const rows = await q<{ norm_key: string }>(
    `select distinct p.norm_key from brief_items b join papers p on p.id = b.paper_id
      where b.run_id <> $1 and b.kind = 'featured' and p.norm_key is not null`,
    [runId],
  );
  return new Set(rows.map((r) => r.norm_key));
}
