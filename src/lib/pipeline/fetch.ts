import { previouslyFeaturedKeys, normKey, upsertPaper } from "../papers";
import { getRun, logRun, setFetchState, domainsOf } from "../runs";
import { fetchArxiv, type RawPaper } from "../sources/arxiv";
import { fetchSemanticScholar } from "../sources/semanticScholar";
import { abortScholarRun, pollScholarRun, SCHOLAR_TIMEOUT_MS, startScholarRun } from "../sources/scholar";
import type { FetchState, Source } from "../types";

const FINAL: FetchState["status"][] = ["done", "failed", "timed_out", "skipped"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function blank(): FetchState {
  return { status: "pending", fetched: 0, kept: 0, gated_old: 0, gated_seen: 0 };
}

/** Writes papers that pass the code-side gate (G3: last 7 days, not in an earlier brief). */
async function store(runId: string, source: Source, domain: string, papers: RawPaper[], since: Date, state: FetchState) {
  const seen = await previouslyFeaturedKeys(runId);
  state.fetched = papers.length;
  for (const p of papers) {
    const tooOld =
      p.date_precision === "year"
        ? // Year-only dates (some Scholar items) cannot be checked to the day: keep this year and last.
          p.published_at !== null && new Date(p.published_at).getUTCFullYear() < since.getUTCFullYear() - 1
        : !p.published_at || new Date(p.published_at) < since;
    if (tooOld) {
      state.gated_old++;
      continue;
    }
    if (seen.has(normKey(p))) {
      state.gated_seen++;
      continue;
    }
    await upsertPaper(runId, source, domain, p);
    state.kept++;
  }
}

/** One source for one domain. Idempotent: a finished source/domain pair returns its stored state. */
export async function fetchStep(runId: string, source: Source, domainName: string): Promise<FetchState> {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found.");
  const domain = domainsOf(run).find((d) => d.name === domainName);
  if (!domain) throw new Error(`Domain "${domainName}" is not part of this run.`);

  const prev = run.progress.fetch?.[source]?.[domainName];
  if (prev && FINAL.includes(prev.status)) return prev;
  if (run.step !== "fetch") {
    const s = { ...(prev ?? blank()), status: "skipped" as const, error: "Fetching had already finished." };
    await setFetchState(runId, source, domainName, s);
    return s;
  }

  const since = new Date(new Date(run.started_at).getTime() - 7 * 24 * 3600 * 1000);
  const state: FetchState = { ...blank(), ...(prev ?? {}) };

  try {
    if (source === "arxiv") {
      await sleep(3000); // arXiv asks for 3 seconds between calls
      await store(runId, source, domainName, await fetchArxiv(domain), since, state);
      state.status = "done";
    } else if (source === "semantic_scholar") {
      const { papers, errors } = await fetchSemanticScholar(domain, since);
      await store(runId, source, domainName, papers, since, state);
      if (errors.length) state.error = `Some keyword searches failed: ${errors.join("; ")}`;
      state.status = "done";
    } else {
      if (!process.env.APIFY_TOKEN) {
        state.status = "skipped";
        state.error = "APIFY_TOKEN is not set, so Google Scholar was skipped.";
      } else if (!state.apify_run_id) {
        try {
          state.apify_run_id = await startScholarRun(domain);
          state.started_at = new Date().toISOString();
          state.status = "running";
          delete state.error;
        } catch (e) {
          // Apify's free plan runs 5 actors at once; a sixth domain waits for a slot within the same 90 s window.
          if (!/concurrent/i.test((e as Error).message)) throw e;
          state.queued_at ??= new Date().toISOString();
          if (Date.now() - Date.parse(state.queued_at) > SCHOLAR_TIMEOUT_MS) {
            state.status = "timed_out";
            state.error = "Google Scholar had no free Apify run slot within 90 seconds.";
            await logRun(runId, `Google Scholar timed out for ${domainName}. The brief was built from the other sources.`);
          } else {
            state.status = "pending";
            state.error = "Waiting for a free Apify run slot (the free plan allows 5 at once).";
          }
        }
      } else {
        const elapsed = Date.now() - Date.parse(state.started_at ?? run.started_at);
        const poll = await pollScholarRun(state.apify_run_id);
        if (poll.state === "done") {
          await store(runId, source, domainName, poll.papers, since, state);
          state.status = "done";
        } else if (poll.state === "failed") {
          state.status = "failed";
          state.error = poll.reason;
        } else if (elapsed > SCHOLAR_TIMEOUT_MS) {
          await abortScholarRun(state.apify_run_id);
          state.status = "timed_out";
          state.error = "Google Scholar timed out after 90 seconds.";
          await logRun(runId, `Google Scholar timed out for ${domainName}. The brief was built from the other sources.`);
        }
      }
    }
  } catch (e) {
    state.status = "failed";
    state.error = (e as Error).message;
    await logRun(runId, `${source} failed for ${domainName}: ${state.error}`);
  }
  await setFetchState(runId, source, domainName, state);
  return state;
}
