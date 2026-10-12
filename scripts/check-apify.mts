// Shows why Apify rejects a Scholar run, without printing the token.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const token = process.env.APIFY_TOKEN!;
const me = await fetch("https://api.apify.com/v2/users/me", { headers: { Authorization: `Bearer ${token}` } });
const meJson = await me.json();
console.log("users/me:", me.status, meJson.data ? { plan: meJson.data.plan?.id, username: meJson.data.username ? "(set)" : null } : meJson.error);
const actor = (process.env.APIFY_SCHOLAR_ACTOR_ID || "marco.gullo~google-scholar-scraper").replace("/", "~");
const info = await fetch(`https://api.apify.com/v2/acts/${actor}`, { headers: { Authorization: `Bearer ${token}` } });
const infoJson = await info.json();
console.log("actor:", info.status, infoJson.data ? { pricing: infoJson.data.pricingInfos?.at(-1) } : infoJson.error);
