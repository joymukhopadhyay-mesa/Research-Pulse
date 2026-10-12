// Times one real scoring batch (10 papers from the latest run) at different reasoning efforts. Writes nothing.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { q } = await import("../src/lib/db.ts");
const { chatJson } = await import("../src/lib/gemini.ts");
const { scoringPrompt, SCORING_SCHEMA } = await import("../src/lib/prompts.ts");
const run = (await q<{ id: string; domains: any }>("select id, domains from runs order by started_at desc limit 1"))[0];
const papers = await q<any>("select id, source, title, abstract from papers where run_id = $1 and dup_of is null limit 10", [run.id]);
const { system, user } = scoringPrompt(run.domains, papers.map((p: any) => ({ paper_id: p.id, source: p.source, title: p.title, abstract: p.abstract || "(none)" })));
for (const effort of [undefined, "low", "minimal"] as const) {
  const t = Date.now();
  try {
    const out = await chatJson<{ results: any[] }>({ system, user, schema: SCORING_SCHEMA, reasoning: effort });
    console.log(`effort=${effort ?? "default"}: ${((Date.now() - t) / 1000).toFixed(1)}s, ${out.results.length} results, sample:`, JSON.stringify(out.results[0]).slice(0, 220));
  } catch (e) {
    console.log(`effort=${effort ?? "default"}: error after ${((Date.now() - t) / 1000).toFixed(1)}s:`, (e as Error).message.slice(0, 200));
  }
}
