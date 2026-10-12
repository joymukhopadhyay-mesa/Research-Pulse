// Runs the Scholar actor once with 5 items, waits for it, and shows the output fields our parser reads.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { startScholarRun, pollScholarRun } = await import("../src/lib/sources/scholar.ts");
const t = Date.now();
const runId = await startScholarRun({ name: "RAG", keywords: ["retrieval-augmented generation"], arxiv_categories: [] });
console.log("started run", runId);
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  const p = await pollScholarRun(runId);
  if (p.state === "running") continue;
  console.log(`finished in ${((Date.now() - t) / 1000).toFixed(0)}s:`, p.state);
  if (p.state === "failed") { console.log(p.reason); break; }
  console.log(`${p.papers.length} papers parsed`);
  for (const x of p.papers.slice(0, 3)) console.log(" ", x.published_at?.slice(0, 4), x.url.slice(0, 70), "|", x.title.slice(0, 60), "| abstract:", (x.abstract ?? "").slice(0, 50));
  break;
}
// Raw field names, to check the parser against the actor's real output.
const token = process.env.APIFY_TOKEN!;
const run = (await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, { headers: { Authorization: `Bearer ${token}` } })).json()).data;
const items = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?clean=true&limit=1`, { headers: { Authorization: `Bearer ${token}` } })).json();
console.log("raw fields:", Object.keys(items[0] ?? {}).join(", "));
