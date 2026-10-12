import { fetchArxiv } from "../src/lib/sources/arxiv.ts";
const d = { name: "CV", keywords: ["industrial anomaly detection", "visual inspection deep learning", "defect detection"], arxiv_categories: ["cs.CV"] };
const r = await fetchArxiv(d);
console.log("returned", r.length, "| newest:", r.slice(0, 3).map((p) => p.published_at?.slice(0, 10)), "| oldest:", r.at(-1)?.published_at?.slice(0, 10));
const loose = await fetchArxiv({ ...d, arxiv_categories: [] , keywords: ["anomaly detection", "defect detection"] });
console.log("broader keywords, no category filter:", loose.length, "| newest:", loose.slice(0, 3).map((p) => p.published_at?.slice(0, 10)));
