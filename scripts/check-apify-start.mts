import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const token = process.env.APIFY_TOKEN!;
const actor = "marco.gullo~google-scholar-scraper";
for (const qs of ["timeout=120&memory=1024", ""]) {
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/runs${qs ? "?" + qs : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ keyword: "retrieval augmented generation", maxItems: 5, filter: "all", sortBy: "date", articleType: "any", proxyOptions: { useApifyProxy: true } }),
  });
  const j = await res.json();
  console.log(`[${qs || "no options"}]`, res.status, j.error ?? { id: j.data?.id, status: j.data?.status });
  if (j.data?.id) {
    await fetch(`https://api.apify.com/v2/actor-runs/${j.data.id}/abort`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    console.log("aborted test run");
    break;
  }
}
