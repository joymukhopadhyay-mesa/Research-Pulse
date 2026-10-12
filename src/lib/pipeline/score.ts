import { one, q } from "../db";
import { chatJson, GeminiError } from "../gemini";
import { SCORING_SCHEMA, scoringPrompt, type ScoreResult } from "../prompts";
import { finalScore, rubricParams } from "../rubric";
import { domainsOf, getRun, logRun, patchProgress, setStatus } from "../runs";

const BATCH = 10;
const clamp03 = (n: unknown) => Math.max(0, Math.min(3, Math.round(Number(n) || 0)));

/** R1 enforced in code: a 2 or 3 without a supporting quote drops to 1. */
function enforceProof(r: ScoreResult) {
  const dims = ["shift", "client_relevance", "evidence", "maturity"] as const;
  const out = { shift: 0, client_relevance: 0, evidence: 0, maturity: 0 };
  for (const d of dims) {
    let v = clamp03(r[d]);
    if (v >= 2 && !(r.proof?.[d] ?? "").trim()) v = 1;
    out[d] = v;
  }
  return out;
}

export async function counts(runId: string) {
  const r = await one<{ total: number; done: number }>(
    `select count(*)::int as total, count(s.id)::int as done
       from papers p left join scores s on s.paper_id = p.id
      where p.run_id = $1 and p.dup_of is null`,
    [runId],
  );
  return r ?? { total: 0, done: 0 };
}

/** Scores one batch of up to 10 unscored papers. Safe to call concurrently and repeatedly. */
export async function scoreStep(runId: string) {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found.");
  if (run.step === "fetch") {
    await setStatus(runId, "scoring", "score");
    const p = rubricParams();
    for (const w of p.warnings) await logRun(runId, w);
  }

  const batch = await q<{ id: string; source: string; title: string; abstract: string | null }>(
    `update papers set claimed_at = now()
      where id in (
        select p.id from papers p left join scores s on s.paper_id = p.id
         where p.run_id = $1 and p.dup_of is null and s.id is null
           and (p.claimed_at is null or p.claimed_at < now() - interval '3 minutes')
         order by p.published_at desc nulls last
         limit ${BATCH}
         for update of p skip locked)
      returning id, source, title, abstract`,
    [runId],
  );

  if (batch.length) {
    try {
      const params = rubricParams();
      const { system, user } = scoringPrompt(
        domainsOf(run),
        batch.map((b) => ({
          paper_id: b.id,
          source: b.source,
          title: b.title,
          abstract: b.abstract || "(no abstract available)",
        })),
      );
      const out = await chatJson<{ results: ScoreResult[] }>({ system, user, schema: SCORING_SCHEMA, reasoning: "low" });
      const ids = new Set(batch.map((b) => b.id));
      for (const r of out.results ?? []) {
        if (!ids.has(r.paper_id)) continue;
        const dims = enforceProof(r);
        await q(
          `insert into scores (paper_id, gate_pass, gate_reason, shift, shift_types, client_relevance, client_questions,
                               evidence, maturity, proof, uncertain, one_line_reason, final_score, domains)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           on conflict (paper_id) do nothing`,
          [
            r.paper_id,
            r.gate_pass !== false,
            r.gate_pass === false ? r.gate_reason || null : null,
            dims.shift,
            (r.shift_type ?? []).filter((t) => ["new_benchmark", "surprising_result", "reframing"].includes(t)),
            dims.client_relevance,
            (r.client_questions ?? []).filter((x) => ["Q1", "Q2", "Q3"].includes(x)),
            dims.evidence,
            dims.maturity,
            JSON.stringify(r.proof ?? {}),
            !!r.uncertain,
            (r.one_line_reason ?? "").slice(0, 300),
            finalScore(dims, params),
            r.domains ?? [],
          ],
        );
      }
      // Papers Gemini skipped are released so the next call retries them.
      await q(
        `update papers set claimed_at = null where id = any($1::uuid[]) and not exists (select 1 from scores s where s.paper_id = papers.id)`,
        [batch.map((b) => b.id)],
      );
    } catch (e) {
      await q(`update papers set claimed_at = null where id = any($1::uuid[])`, [batch.map((b) => b.id)]);
      // A slow batch is released for another try rather than failing the run.
      if (e instanceof GeminiError && e.timedOut) {
        const c = await counts(runId);
        return { ...c, remaining: c.total - c.done, claimed: 0, timedOut: true };
      }
      throw e;
    }
  }

  const c = await counts(runId);
  await patchProgress(runId, "score", c);
  return { ...c, remaining: c.total - c.done, claimed: batch.length };
}
