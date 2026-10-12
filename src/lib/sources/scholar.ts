import type { Domain } from "../types";
import type { RawPaper } from "./arxiv";

/** Google Scholar via an Apify actor, started asynchronously and polled. Never blocks the brief. */
const API = "https://api.apify.com/v2";
export const SCHOLAR_TIMEOUT_MS = 90_000;

function creds() {
  const token = process.env.APIFY_TOKEN;
  const actor = (process.env.APIFY_SCHOLAR_ACTOR_ID || "marco.gullo~google-scholar-scraper").replace("/", "~");
  if (!token) throw new Error("APIFY_TOKEN is not set.");
  return { token, actor };
}

export async function startScholarRun(d: Domain): Promise<string> {
  const { token, actor } = creds();
  const keyword = d.keywords.map((k) => (k.includes(" ") ? `"${k}"` : k)).join(" OR ");
  const res = await fetch(`${API}/acts/${actor}/runs?timeout=120&memory=1024`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      keyword,
      maxItems: 20,
      filter: "all",
      sortBy: "date",
      articleType: "any",
      proxyOptions: { useApifyProxy: true },
      enableDebugDumps: false,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const reason = body?.error?.message ? `: ${body.error.message}` : ".";
    throw new Error(`Apify returned ${res.status} when starting the Scholar run${reason}`);
  }
  const json = await res.json();
  return json.data.id as string;
}

export type ScholarPoll =
  | { state: "running" }
  | { state: "failed"; reason: string }
  | { state: "done"; papers: RawPaper[] };

type ScholarItem = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function toPaper(it: ScholarItem): RawPaper | null {
  const title = str(it.title);
  const url = str(it.link) || str(it.documentLink) || str(it.url) || str(it.articleUrl);
  if (!title || !/^https?:\/\//.test(url)) return null;
  const authorsRaw = it.authors;
  const authors = Array.isArray(authorsRaw)
    ? authorsRaw.map((a) => (typeof a === "string" ? a : str((a as ScholarItem).name))).filter(Boolean)
    : str(authorsRaw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  const year = Number(it.year ?? it.publicationYear);
  // With date sorting, Scholar prefixes the snippet with its age ("2 days ago - …"): an exact date for G3.
  let snippet = str(it.searchMatch) || str(it.snippet) || str(it.description);
  let published: string | null = Number.isFinite(year) && year > 1900 ? new Date(Date.UTC(year, 0, 1)).toISOString() : null;
  const age = snippet.match(/^(\d+)\s+(day|hour|minute)s?\s+ago\s*[-–—]\s*/i);
  if (age) {
    const unitMs = { day: 864e5, hour: 36e5, minute: 6e4 }[age[2].toLowerCase() as "day" | "hour" | "minute"];
    published = new Date(Date.now() - Number(age[1]) * unitMs).toISOString();
    snippet = snippet.slice(age[0].length);
  }
  return {
    external_id: url,
    title,
    abstract: snippet.replace(/^…\s*/, "") || null,
    url,
    authors,
    published_at: published,
    date_precision: age ? "day" : "year",
    arxiv_id: null,
    doi: null,
  };
}

export async function pollScholarRun(runId: string): Promise<ScholarPoll> {
  const { token } = creds();
  const res = await fetch(`${API}/actor-runs/${runId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { state: "failed", reason: `Apify returned ${res.status} when checking the run.` };
  const run = (await res.json()).data;
  if (["READY", "RUNNING"].includes(run.status)) return { state: "running" };
  if (run.status !== "SUCCEEDED") return { state: "failed", reason: `Apify run ended with status ${run.status}.` };
  const items = await fetch(`${API}/datasets/${run.defaultDatasetId}/items?clean=true&format=json`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!items.ok) return { state: "failed", reason: `Apify returned ${items.status} when reading results.` };
  const data = (await items.json()) as ScholarItem[];
  return { state: "done", papers: data.map(toPaper).filter((p): p is RawPaper => !!p) };
}

export async function abortScholarRun(runId: string): Promise<void> {
  try {
    const { token } = creds();
    await fetch(`${API}/actor-runs/${runId}/abort`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // Best effort: a run we stop waiting on is already excluded from the brief.
  }
}
