import { q } from "./db";
import { getRun, domainsOf } from "./runs";
import { quietNotice } from "./selection";
import type { Run, Source } from "./types";

export type Card = {
  item_id: string;
  paper_id: string;
  domain: string;
  rank: number;
  kind: "featured" | "runner_up";
  title: string;
  url: string;
  source: Source;
  authors: string[];
  published_at: string | null;
  tags: string[];
  final_score: number;
  shift: number;
  client_relevance: number;
  evidence: number;
  maturity: number;
  uncertain: boolean;
  one_line_reason: string | null;
  whats_new: string | null;
  why_it_matters: string | null;
  client_angle: string | null;
  evidence_note: string | null;
  verdict: string | null;
  useful: boolean | null;
  also_on: { source: Source; url: string }[];
};

export type NewsItem = { id: string; headline: string; summary: string; url: string; related_domain: string | null };
export type CoverageRow = {
  domain: string;
  scanned: number;
  gated_out: number;
  scored: number;
  selected: number;
  by_source: Record<string, number>;
};
export type Section = { domain: string; cards: Card[]; notice: string | null };

export type Brief = {
  run: Run;
  sections: Section[];
  runnerUps: Card[];
  news: NewsItem[];
  coverage: CoverageRow[];
  links: { source: string; items: { title: string; url: string }[] }[];
};

export async function loadBrief(runId: string): Promise<Brief | null> {
  const run = await getRun(runId);
  if (!run) return null;

  const cards = await q<Card>(
    `select b.id as item_id, b.paper_id, b.domain, b.rank, b.kind, p.title, p.url, p.source, p.authors, p.published_at,
            s.domains as tags, s.final_score::float as final_score, s.shift, s.client_relevance, s.evidence, s.maturity,
            s.uncertain, s.one_line_reason, b.whats_new, b.why_it_matters, b.client_angle, b.evidence_note, b.verdict,
            r.useful,
            coalesce((select json_agg(json_build_object('source', d.source, 'url', d.url)) from papers d where d.dup_of = p.id), '[]') as also_on
       from brief_items b
       join papers p on p.id = b.paper_id
       left join scores s on s.paper_id = p.id
       left join ratings r on r.brief_item_id = b.id
      where b.run_id = $1
      order by b.domain, b.kind, b.rank`,
    [runId],
  );

  const coverage = await q<CoverageRow>(
    `select domain, scanned, gated_out, scored, selected, by_source from coverage where run_id = $1`,
    [runId],
  );
  const covMap = new Map(coverage.map((c) => [c.domain, c]));

  const sections: Section[] = domainsOf(run).map((d) => {
    const featured = cards.filter((c) => c.kind === "featured" && c.domain === d.name);
    const quiet = run.progress.select?.quiet?.includes(d.name);
    const scanned = covMap.get(d.name)?.scanned ?? 0;
    let notice: string | null = null;
    if (!featured.length) {
      notice = quiet
        ? quietNotice(d.name, scanned)
        : `${d.name}: ${scanned} papers scanned. Its strongest papers did not fit in this week's 12 and are listed in the runner-ups.`;
    }
    return { domain: d.name, cards: featured, notice };
  });

  const newsRows = await q<NewsItem>(
    `select n.id, n.headline, n.summary, n.url, b.domain as related_domain
       from news_items n left join brief_items b on b.paper_id = n.related_paper_id and b.run_id = n.run_id and b.kind = 'featured'
      where n.run_id = $1 order by n.id`,
    [runId],
  );

  const linkRows = await q<{ source: string; title: string; url: string }>(
    `select source, title, url from papers where run_id = $1 order by source, title`,
    [runId],
  );
  const grouped = new Map<string, { title: string; url: string }[]>();
  for (const l of linkRows) {
    if (!grouped.has(l.source)) grouped.set(l.source, []);
    grouped.get(l.source)!.push({ title: l.title, url: l.url });
  }
  const links = [...grouped.entries()].map(([source, items]) => ({ source, items }));
  if (newsRows.length) links.push({ source: "news", items: newsRows.map((n) => ({ title: n.headline, url: n.url })) });

  return {
    run,
    sections,
    runnerUps: cards.filter((c) => c.kind === "runner_up"),
    news: newsRows,
    coverage,
    links,
  };
}

const words = (s: string | null | undefined) => (s ? s.trim().split(/\s+/).filter(Boolean).length : 0);

/** Words Kavita reads in the brief body: headers, cards, quiet notices and news. Appendix excluded. */
export function briefWordCount(b: Brief, noNewsLine: boolean): number {
  let n = words("Research Pulse weekly brief") + words("In the news");
  for (const s of b.sections) {
    n += words(s.domain) + words(s.notice);
    for (const c of s.cards) {
      n += words(c.title) + words(c.whats_new) + words(c.why_it_matters) + words(c.client_angle) + words(c.evidence_note);
      n += words(c.verdict);
    }
  }
  for (const item of b.news) n += words(item.headline) + words(item.summary);
  if (noNewsLine) n += words("No notable news this week");
  return n;
}
