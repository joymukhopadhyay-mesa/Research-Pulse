// Unit check of rubric Layer 3 (S1-S8) with synthetic candidates. Nothing is written anywhere.
import assert from "node:assert/strict";
import { rubricParams } from "../src/lib/rubric.ts";
import { selectPapers, type Candidate } from "../src/lib/selection.ts";

const p = rubricParams();
let n = 0;
const c = (domain: string, score: number, o: Partial<Candidate> = {}): Candidate => ({
  paper_id: `p${++n}`, domains: [domain], fetched_domains: [domain], final_score: score, shift: 1, evidence: 1,
  uncertain: false, published_at: "2026-10-08T00:00:00Z", ...o,
});
const A = "Agents", B = "RAG", C = "Vision", D = "Code";
const cands = [
  c(A, 9.0), c(A, 8.5), c(A, 8.0), c(A, 7.5), // 4 above bar in A -> cap 3
  c(A, 6.0, { shift: 3, evidence: 2 }),        // must-see beyond cap and below bar
  c(B, 6.0), c(B, 5.5),                        // floor: B gets its best (6.0)
  c(C, 4.0), c(C, 3.0, { uncertain: true }),   // quiet: nothing >= 5.0
  c(D, 5.2, { uncertain: true }),              // floor slot for D
  c(B, 7.1, { domains: ["Code", "RAG"], fetched_domains: ["RAG"] }), // S8: home = Code
];
const sel = selectPapers(cands, [A, B, C, D], p, { [A]: 40, [B]: 30, [C]: 12, [D]: 8 });
const byDomain = (d: string) => sel.featured.filter((f) => f.domain === d).map((f) => f.paper_id);
console.log("featured:", sel.featured.map((f) => `${f.domain}:${f.paper_id}#${f.rank}${f.must_see ? "!" : ""}`).join(" "));
console.log("runner-ups:", sel.runnerUps.map((r) => `${r.domain}:${r.paper_id}`).join(" "));
console.log("quiet:", sel.quiet);
assert.equal(byDomain(A).length, 4, "3 by cap + 1 must-see override");
assert.ok(byDomain(A).includes("p5"), "must-see included despite cap");
assert.ok(!byDomain(A).includes("p4"), "4th above-bar paper dropped by cap");
assert.deepEqual(byDomain(B), ["p6"], "floor slot: best paper >= 5.0");
assert.deepEqual(byDomain(D), ["p11"], "S8: tagged Code first, so it sits under Code and fills its floor");
assert.ok(sel.runnerUps.some((r) => r.paper_id === "p10"), "uncertain >= 5.0 goes to runner-ups");
assert.deepEqual(sel.quiet, [{ domain: C, scanned: 12 }]);
assert.ok(sel.runnerUps.some((r) => r.paper_id === "p4"), "next highest goes to runner-ups");
assert.ok(sel.featured.length <= p.totalCap);
// Total cap of 12 with many strong papers
n = 100;
const many = [A, B, C, D].flatMap((d) => [9, 8.8, 8.6, 8.4].map((s) => c(d, s)));
const sel2 = selectPapers(many, [A, B, C, D], p, {});
assert.equal(sel2.featured.length, 12);
assert.ok([A, B, C, D].every((d) => sel2.featured.filter((f) => f.domain === d).length === 3));
console.log("all selection checks passed");
