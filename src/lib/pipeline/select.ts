import { one, q, tx } from "../db";
import { rubricParams } from "../rubric";
import { domainsOf, getRun, patchProgress, setStatus, stepIndex } from "../runs";
import { selectPapers, type Candidate } from "../selection";

export async function selectStep(runId: string) {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found.");
  if (stepIndex(run.step) > stepIndex("select")) return run.progress.select;

  // Claim the step so two overlapping calls cannot both write the brief.
  const claimed = await one(
    `update runs set status = 'selecting', step = 'select'
      where id = $1 and step in ('fetch','score','select') and status <> 'selecting' returning id`,
    [runId],
  );
  if (!claimed) return { busy: true };

  const params = rubricParams();
  const domains = domainsOf(run);
  const names = domains.map((d) => d.name);

  const rows = await q<Candidate & { gate_pass: boolean; score_domains: string[] }>(
    `select p.id as paper_id, s.domains as score_domains, p.domains as fetched_domains, s.final_score::float as final_score,
            s.shift, s.evidence, s.uncertain, p.published_at, s.gate_pass
       from papers p join scores s on s.paper_id = p.id
      where p.run_id = $1 and p.dup_of is null`,
    [runId],
  );
  const candidates: Candidate[] = rows
    .filter((r) => r.gate_pass)
    .map((r) => ({ ...r, domains: r.score_domains ?? [] }));

  // Scanned per domain = every item a source returned for that domain's search.
  const scanned: Record<string, number> = {};
  const bySource: Record<string, Record<string, number>> = {};
  const codeGated: Record<string, number> = {};
  for (const [source, perDomain] of Object.entries(run.progress.fetch ?? {})) {
    for (const [d, st] of Object.entries(perDomain)) {
      scanned[d] = (scanned[d] ?? 0) + (st.fetched ?? 0);
      codeGated[d] = (codeGated[d] ?? 0) + (st.gated_old ?? 0) + (st.gated_seen ?? 0);
      (bySource[d] ??= {})[source] = st.fetched ?? 0;
    }
  }

  const sel = selectPapers(candidates, names, params, scanned);

  // Brief items and the coverage log are replaced in one transaction.
  const statements: [string, unknown[]][] = [
    ["delete from brief_items where run_id = $1", [runId]],
    ["delete from coverage where run_id = $1", [runId]],
  ];
  for (const f of sel.featured) {
    statements.push([
      `insert into brief_items (run_id, paper_id, domain, rank, kind) values ($1,$2,$3,$4,'featured') on conflict do nothing`,
      [runId, f.paper_id, f.domain, f.rank],
    ]);
  }
  for (const r of sel.runnerUps) {
    statements.push([
      `insert into brief_items (run_id, paper_id, domain, rank, kind) values ($1,$2,$3,$4,'runner_up') on conflict do nothing`,
      [runId, r.paper_id, r.domain, r.rank],
    ]);
  }
  // S9 coverage log.
  for (const d of names) {
    const tagged = rows.filter((r) => (r.fetched_domains ?? []).includes(d));
    statements.push([
      `insert into coverage (run_id, domain, scanned, gated_out, scored, selected, by_source) values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        runId,
        d,
        scanned[d] ?? 0,
        (codeGated[d] ?? 0) + tagged.filter((r) => !r.gate_pass).length,
        tagged.filter((r) => r.gate_pass).length,
        sel.featured.filter((f) => f.domain === d).length,
        JSON.stringify(bySource[d] ?? {}),
      ],
    ]);
  }
  await tx(statements);

  const summary = { featured: sel.featured.length, runner_up: sel.runnerUps.length, quiet: sel.quiet.map((x) => x.domain) };
  await patchProgress(runId, "select", summary);
  await setStatus(runId, "writing", "write");
  return summary;
}
