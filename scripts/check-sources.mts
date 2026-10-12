// Live smoke test: fetch real papers from arXiv and Semantic Scholar for one domain, and parse the rubric.
import { fetchArxiv } from "../src/lib/sources/arxiv.ts";
import { fetchSemanticScholar } from "../src/lib/sources/semanticScholar.ts";
import { rubricParams, finalScore } from "../src/lib/rubric.ts";

const domain = { name: "Retrieval-augmented generation", keywords: ["retrieval-augmented generation", "RAG"], arxiv_categories: ["cs.CL", "cs.IR"] };
const since = new Date(Date.now() - 7 * 864e5);

const p = rubricParams();
console.log("rubric:", JSON.stringify({ ...p, warnings: p.warnings.length }));
console.log("score(3,3,3,3) =", finalScore({ shift: 3, client_relevance: 3, evidence: 3, maturity: 3 }, p),
  " score(2,2,2,1) =", finalScore({ shift: 2, client_relevance: 2, evidence: 2, maturity: 1 }, p));

const ax = await fetchArxiv(domain);
const recent = ax.filter((x) => x.published_at && new Date(x.published_at) >= since);
console.log(`arXiv: ${ax.length} returned, ${recent.length} in last 7 days`);
for (const x of recent.slice(0, 3)) console.log("  ", x.published_at?.slice(0, 10), x.url, "|", x.title.slice(0, 80));

const s2 = await fetchSemanticScholar(domain, since);
console.log(`Semantic Scholar: ${s2.papers.length} papers, errors: ${s2.errors.length}`, s2.errors.slice(0, 2));
for (const x of s2.papers.slice(0, 3)) console.log("  ", x.published_at?.slice(0, 10), x.url, "|", x.title.slice(0, 80));
