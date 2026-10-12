import { briefWordCount, loadBrief } from "../brief";
import { one, q } from "../db";
import { chat, chatJson, type UrlCitation } from "../gemini";
import { NEWS_SCHEMA, newsSearchPrompt, newsWritePrompt, WRITING_SCHEMA, writingPrompt, type CardResult } from "../prompts";
import { rubricParams } from "../rubric";
import { domainsOf, getRun, logRun, patchProgress, setStatus, stepIndex } from "../runs";
import { isMustSee } from "../selection";
import { validateArxivIds } from "../sources/arxiv";
import type { RunProgress } from "../types";

const CARDS_PER_CALL = 4;
const VERDICTS = ["READ IN FULL", "FLAG FOR A CLIENT", "KNOW IT EXISTS"];

type WriteState = NonNullable<RunProgress["write"]>;

async function validateLinks(runId: string) {
  const rows = await q<{ item_id: string; external_id: string; title: string }>(
    `select b.id as item_id, p.external_id, p.title from brief_items b join papers p on p.id = b.paper_id
      where b.run_id = $1 and p.source = 'arxiv'`,
    [runId],
  );
  if (!rows.length) return;
  const found = await validateArxivIds(rows.map((r) => r.external_id));
  for (const r of rows) {
    if (!found.has(r.external_id)) {
      await q("delete from brief_items where id = $1", [r.item_id]);
      await logRun(runId, `Removed "${r.title}": arXiv ID ${r.external_id} did not resolve.`);
    }
  }
}

async function writeCards(runId: string): Promise<number> {
  const items = await q<{
    item_id: string;
    domain: string;
    title: string;
    source: string;
    abstract: string | null;
    shift: number;
    shift_types: string[];
    client_relevance: number;
    client_questions: string[];
    evidence: number;
    maturity: number;
    proof: Record<string, string>;
    uncertain: boolean;
    final_score: number;
  }>(
    `select b.id as item_id, b.domain, p.title, p.source, p.abstract, s.shift, s.shift_types, s.client_relevance,
            s.client_questions, s.evidence, s.maturity, s.proof, s.uncertain, s.final_score::float as final_score
       from brief_items b join papers p on p.id = b.paper_id join scores s on s.paper_id = p.id
      where b.run_id = $1 and b.kind = 'featured' and b.whats_new is null
      order by b.domain, b.rank limit ${CARDS_PER_CALL}`,
    [runId],
  );
  if (!items.length) return 0;

  const { system, user } = writingPrompt(
    items.map((i) => ({
      brief_item_id: i.item_id,
      domain: i.domain,
      title: i.title,
      source: i.source,
      preprint: i.source === "arxiv",
      abstract: i.abstract || "(no abstract available)",
      scores: {
        final_score: i.final_score,
        shift: i.shift,
        shift_type: i.shift_types,
        client_relevance: i.client_relevance,
        client_questions: i.client_questions,
        evidence: i.evidence,
        maturity: i.maturity,
        proof: i.proof,
        uncertain: i.uncertain,
      },
    })),
  );
  const out = await chatJson<{ cards: CardResult[] }>({ system, user, schema: WRITING_SCHEMA, temperature: 0.3, reasoning: "low" });
  const bySource = new Map(items.map((i) => [i.item_id, i.source]));
  for (const c of out.cards ?? []) {
    if (!bySource.has(c.brief_item_id)) continue;
    let evidence = c.evidence_note?.trim() ?? "";
    // Every arXiv paper carries the preprint label, whatever the model wrote.
    if (bySource.get(c.brief_item_id) === "arxiv" && !/preprint, not yet peer-reviewed/i.test(evidence)) {
      evidence = `Preprint, not yet peer-reviewed. ${evidence}`.trim();
    }
    await q(
      `update brief_items set whats_new = $2, why_it_matters = $3, client_angle = $4, evidence_note = $5, verdict = $6 where id = $1`,
      [
        c.brief_item_id,
        c.whats_new,
        c.why_it_matters,
        c.client_angle,
        evidence,
        VERDICTS.includes(c.verdict) ? c.verdict : "KNOW IT EXISTS",
      ],
    );
  }
  const left = await one<{ n: number }>(
    `select count(*)::int as n from brief_items where run_id = $1 and kind = 'featured' and whats_new is null`,
    [runId],
  );
  return left?.n ?? 0;
}

/** One grounded search call; every URL comes from the grounding citations, never from the model's text. */
async function writeNews(runId: string): Promise<WriteState["news"]> {
  const run = (await getRun(runId))!;
  await q("delete from news_items where run_id = $1", [runId]);
  const since = new Date(Date.parse(run.started_at) - 7 * 864e5).toISOString().slice(0, 10);
  const grounded = await chat({ user: newsSearchPrompt(domainsOf(run), since), webSearch: true, temperature: 0.2, reasoning: "low" });

  const seen = new Set<string>();
  const results: UrlCitation[] = [];
  for (const c of grounded.citations) {
    if (!/^https?:\/\//.test(c.url) || seen.has(c.url)) continue;
    seen.add(c.url);
    results.push(c);
  }
  if (!results.length) {
    await logRun(runId, "News search returned no grounded sources. The brief says there is no notable news this week.");
    return "none";
  }

  const papers = await q<{ paper_id: string; title: string; domain: string }>(
    `select b.paper_id, p.title, b.domain from brief_items b join papers p on p.id = b.paper_id
      where b.run_id = $1 and b.kind = 'featured'`,
    [runId],
  );
  const { system, user } = newsWritePrompt(
    results.map((r, index) => ({
      index,
      title: r.title ?? "",
      snippet: (r.content ?? "").slice(0, 600),
      site: (() => {
        try {
          return new URL(r.url).hostname;
        } catch {
          return "";
        }
      })(),
    })),
    papers,
    grounded.content,
  );
  const out = await chatJson<{
    items: { source_index: number; headline: string; summary: string; related_paper_id: string }[];
  }>({ system, user, schema: NEWS_SCHEMA, reasoning: "low" });

  const paperIds = new Set(papers.map((p) => p.paper_id));
  const used = new Set<number>();
  let n = 0;
  for (const it of out.items ?? []) {
    const src = results[it.source_index];
    if (!src || used.has(it.source_index) || n >= 5) continue;
    used.add(it.source_index);
    const summary = it.summary.split(/\s+/).slice(0, 40).join(" ");
    await q(`insert into news_items (run_id, headline, summary, url, related_paper_id) values ($1,$2,$3,$4,$5)`, [
      runId,
      it.headline,
      summary,
      src.url,
      paperIds.has(it.related_paper_id) ? it.related_paper_id : null,
    ]);
    n++;
  }
  return n ? "done" : "none";
}

/** Read-time budget: drop the lowest-scored non-must-see paper to runner-ups until under the hard limit. */
async function enforceBudget(runId: string, noNews: boolean) {
  const p = rubricParams();
  for (let guard = 0; guard < 20; guard++) {
    const b = (await loadBrief(runId))!;
    const count = briefWordCount(b, noNews);
    if (count <= p.wordLimit) {
      await q("update runs set word_count = $2, read_minutes = $3 where id = $1", [
        runId,
        count,
        Math.ceil(count / p.wordsPerMinute),
      ]);
      return;
    }
    const featured = b.sections.flatMap((s) => s.cards).filter((c) => !isMustSee(c));
    if (!featured.length) {
      await q("update runs set word_count = $2, read_minutes = $3 where id = $1", [runId, count, Math.ceil(count / p.wordsPerMinute)]);
      return;
    }
    const lowest = featured.sort((a, b2) => a.final_score - b2.final_score)[0];
    await q("update brief_items set kind = 'runner_up' where id = $1", [lowest.item_id]);
    await logRun(runId, `Over the ${p.wordLimit}-word budget (${count}); moved "${lowest.title}" to runner-ups.`);
  }
}

export async function writeStep(runId: string) {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found.");
  if (stepIndex(run.step) > stepIndex("write")) return run.progress.write;
  if (run.step !== "write") throw new Error("Run selection first.");

  const total = await one<{ n: number }>(`select count(*)::int as n from brief_items where run_id = $1 and kind = 'featured'`, [runId]);
  const state: WriteState = run.progress.write ?? { total: total?.n ?? 0, done: 0, news: "pending", validated: false };

  if (!state.validated) {
    await validateLinks(runId);
    state.validated = true;
    const t = await one<{ n: number }>(`select count(*)::int as n from brief_items where run_id = $1 and kind = 'featured'`, [runId]);
    state.total = t?.n ?? 0;
    await patchProgress(runId, "write", state);
    return { ...state, finished: false };
  }

  const left = await writeCards(runId);
  state.done = state.total - left;
  if (left > 0) {
    await patchProgress(runId, "write", state);
    return { ...state, finished: false };
  }

  if (state.news === "running") return { ...state, finished: false };
  if (state.news === "pending" || state.news === "failed") {
    // Claim the news call so a second open tab cannot run it in parallel and double the items.
    const claimed = await one(
      `update runs set progress = jsonb_set(progress, '{write,news}', '"running"')
        where id = $1 and coalesce(progress->'write'->>'news', 'pending') in ('pending', 'failed') returning id`,
      [runId],
    );
    if (!claimed) return { ...state, finished: false };
    try {
      state.news = await writeNews(runId);
    } catch (e) {
      state.news = "failed";
      await patchProgress(runId, "write", state);
      throw new Error(`Google News search failed: ${(e as Error).message}`);
    }
    await patchProgress(runId, "write", state);
    return { ...state, finished: false };
  }

  await enforceBudget(runId, state.news !== "done");
  await patchProgress(runId, "write", state);
  await setStatus(runId, "delivering", "deliver");
  return { ...state, finished: true };
}
