// Reports the OpenRouter key's status and credit usage without printing the key.
import fs from "node:fs";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m![1], m![2]]),
);
const pasted = process.argv[2];
const key = pasted || env.OPENROUTER_API_KEY;
if (pasted) console.log("same as the key in .env.local:", pasted === env.OPENROUTER_API_KEY);
const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
const j = await res.json();
if (!res.ok) { console.log("key check:", res.status, j.error?.message ?? j); process.exit(1); }
const d = j.data;
console.log("key check: valid");
console.log(JSON.stringify({ label: d.label ? "(set)" : null, limit: d.limit, limit_remaining: d.limit_remaining, usage: d.usage, usage_daily: d.usage_daily, usage_monthly: d.usage_monthly, is_free_tier: d.is_free_tier, rate_limit: d.rate_limit }, null, 1));
const cr = await fetch("https://openrouter.ai/api/v1/credits", { headers: { Authorization: `Bearer ${key}` } });
const c = await cr.json();
console.log("credits:", cr.status, cr.ok ? { total: c.data?.total_credits, used: c.data?.total_usage } : c.error?.message);
