"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FetchState, Run } from "@/lib/types";
import { SOURCE_LABEL } from "@/lib/types";
import { fmtDate, PageHeader } from "./ui";

type Counts = { papers: number; unique_papers: number; scored: number; featured: number; news: number };
type State = { run: Run; counts: Counts };

const FETCH_ORDER = ["arxiv", "semantic_scholar"] as const;
const FINAL = ["done", "failed", "timed_out", "skipped"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LEFT_PAGE = "left-page";
const rethrowIfLeft = (e: Error) => {
  // A source that fails is recorded server-side; only leaving the page stops the loop.
  if (e.message === LEFT_PAGE) throw e;
  return null;
};

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
  return json;
}

const STEPS = [
  { key: "create", label: "Run created", endpoint: "POST /api/runs" },
  { key: "fetch", label: "Fetch sources", endpoint: "POST /fetch" },
  { key: "score", label: "Score papers with Gemini", endpoint: "POST /score" },
  { key: "select", label: "Select papers", endpoint: "POST /select" },
  { key: "write", label: "Write cards and news", endpoint: "POST /write" },
  { key: "deliver", label: "PDF and email", endpoint: "POST /deliver" },
  { key: "done", label: "Brief ready", endpoint: "GET /api/runs/[id]" },
];
const ORDER = ["fetch", "score", "select", "write", "deliver", "done"];

function stateOf(stepKey: string, run: Run): "done" | "active" | "failed" | "waiting" {
  if (stepKey === "create") return "done";
  const cur = ORDER.indexOf(run.step);
  const me = ORDER.indexOf(stepKey);
  if (stepKey === "done") return run.step === "done" ? "done" : "waiting";
  if (me < cur) return "done";
  if (me === cur) return run.status === "failed" ? "failed" : "active";
  return "waiting";
}

function Dot({ s }: { s: ReturnType<typeof stateOf> }) {
  const cls =
    s === "done"
      ? "bg-good"
      : s === "active"
        ? "bg-accent-2 animate-pulse"
        : s === "failed"
          ? "bg-danger"
          : "bg-white/15";
  return <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

function fetchLabel(st?: FetchState) {
  if (!st) return "Waiting";
  switch (st.status) {
    case "done":
      return `${st.fetched} found, ${st.kept} kept`;
    case "running":
      return "Running";
    case "timed_out":
      return "Timed out";
    case "skipped":
      return "Skipped";
    case "failed":
      return "Failed";
    default:
      return "Waiting";
  }
}

export function RunDriver({ runId }: { runId: string }) {
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driving, setDriving] = useState(false);
  const [toast, setToast] = useState(false);
  const drivingRef = useRef(false);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Run not found.");
    setData(json);
    return json as State;
  }, [runId]);

  const drive = useCallback(async () => {
    if (drivingRef.current) return;
    drivingRef.current = true;
    setDriving(true);
    setError(null);
    // Every request goes through call(), which stops the loop once the page is left,
    // so a second visit never races an orphaned loop from the first.
    const call = (url: string, body?: unknown) => {
      if (!aliveRef.current) throw new Error(LEFT_PAGE);
      return post(url, body);
    };
    try {
      let s = await refresh();
      if (s.run.status === "failed") {
        await fetch(`/api/runs/${runId}`, { method: "PATCH" });
        s = await refresh();
      }
      const base = `/api/runs/${runId}`;

      if (s.run.step === "fetch") {
        const domains = s.run.domains.map((d) => d.name);
        // Start Scholar first: it runs on Apify while the fast sources are fetched.
        for (const d of domains) await call(`${base}/fetch`, { source: "google_scholar", domain: d }).catch(rethrowIfLeft);
        refresh();
        for (const d of domains) {
          for (const source of FETCH_ORDER) {
            await call(`${base}/fetch`, { source, domain: d }).catch(rethrowIfLeft);
            refresh();
          }
        }
        // Poll Scholar until every domain finishes or times out (90 s from its start, enforced server-side).
        for (let i = 0; i < 40; i++) {
          s = await refresh();
          const pending = domains.filter((d) => !FINAL.includes(s.run.progress.fetch?.google_scholar?.[d]?.status ?? "pending"));
          if (!pending.length) break;
          for (const d of pending) await call(`${base}/fetch`, { source: "google_scholar", domain: d }).catch(rethrowIfLeft);
          await sleep(5000);
        }
        s = await refresh();
      }

      if (s.run.step === "fetch" || s.run.step === "score") {
        // Three workers score batches of 10 in parallel; the server hands each a different batch.
        const worker = async () => {
          for (;;) {
            const r = await call(`${base}/score`);
            refresh();
            if (r.remaining <= 0) return;
            // Every unscored batch is held by another worker: wait instead of spinning.
            if (r.claimed === 0) await sleep(4000);
          }
        };
        await Promise.all([worker(), worker(), worker()]);
        s = await refresh();
      }

      if (s.run.step === "score" || s.run.step === "select") {
        for (let i = 0; i < 20; i++) {
          const r = await call(`${base}/select`);
          if (!r.busy) break;
          await sleep(3000);
        }
        s = await refresh();
      }

      if (s.run.step === "write") {
        for (let i = 0; i < 30; i++) {
          const r = await call(`${base}/write`);
          refresh();
          if (r.finished) break;
        }
        s = await refresh();
      }

      if (s.run.step === "deliver") {
        await call(`${base}/deliver`);
        s = await refresh();
      }
      if (s.run.step === "done") setToast(true);
    } catch (e) {
      if ((e as Error).message === LEFT_PAGE) return;
      setError((e as Error).message);
      await refresh().catch(() => null);
    } finally {
      drivingRef.current = false;
      if (aliveRef.current) setDriving(false);
    }
  }, [runId, refresh]);

  useEffect(() => {
    aliveRef.current = true;
    refresh()
      .then((s) => {
        if (s.run.step !== "done" && s.run.status !== "failed") drive();
      })
      .catch((e) => setError(e.message));
    return () => {
      aliveRef.current = false;
    };
  }, [refresh, drive]);

  if (!data) {
    return error ? <p className="text-sm text-danger">{error}</p> : <p className="text-sm text-muted">Loading run…</p>;
  }

  const { run, counts } = data;
  const domains = run.domains.map((d) => d.name);
  const scholarStates = Object.values(run.progress.fetch?.google_scholar ?? {});
  const scholarTimedOut = scholarStates.some((x) => x.status === "timed_out");
  const scholarSkipped = scholarStates.length > 0 && scholarStates.every((x) => x.status === "skipped");
  const scholarFailed = scholarStates.length > 0 && scholarStates.every((x) => x.status === "failed");

  return (
    <div className="max-w-4xl">
      <PageHeader title="This week's run" sub={`Started ${fmtDate(run.started_at, true)}`}>
        {run.step === "done" && (
          <Link href={`/briefs/${run.id}`} className="btn btn-primary">
            Open the brief
          </Link>
        )}
      </PageHeader>

      {toast && (
        <div role="status" className="card mb-4 border-good/40 text-sm">
          Brief ready.{" "}
          <Link href={`/briefs/${run.id}`} className="underline">
            Read it now
          </Link>
          {run.progress.deliver?.email === "sent" ? " The PDF is on its way to your inbox." : ""}
        </div>
      )}

      {(run.status === "failed" || error) && (
        <div role="alert" className="card mb-4 border-danger/40">
          <p className="text-sm font-medium text-danger">The {run.step} step failed.</p>
          <p className="mt-1 text-sm text-muted">{run.error || error}</p>
          <button className="btn mt-3" onClick={drive} disabled={driving}>
            Retry the {run.step} step
          </button>
        </div>
      )}

      {scholarTimedOut && (
        <p className="mb-4 text-sm text-warn">Google Scholar timed out. The brief was built from the other sources.</p>
      )}
      {scholarFailed && (
        <p className="mb-4 text-sm text-warn">
          Google Scholar failed, so the brief was built from the other sources. {scholarStates[0]?.error}
        </p>
      )}
      {scholarSkipped && (
        <p className="mb-4 text-sm text-warn">Google Scholar was skipped: {scholarStates[0]?.error}</p>
      )}

      <ol className="card space-y-5" aria-label="Pipeline progress">
        {STEPS.map((step) => {
          const s = stateOf(step.key, run);
          return (
            <li key={step.key} className="flex gap-3">
              <Dot s={s} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {step.label}{" "}
                  <span className="sr-only">
                    ({s === "done" ? "done" : s === "active" ? "in progress" : s === "failed" ? "failed" : "waiting"})
                  </span>
                </p>
                <p className="text-xs text-muted">{step.endpoint}</p>

                {step.key === "fetch" && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead className="text-muted">
                        <tr>
                          <th className="py-1 pr-3 font-normal">Domain</th>
                          {(["arxiv", "semantic_scholar", "google_scholar"] as const).map((src) => (
                            <th key={src} className="py-1 pr-3 font-normal">
                              {SOURCE_LABEL[src]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {domains.map((d) => (
                          <tr key={d} className="border-t border-line">
                            <td className="py-1.5 pr-3">{d}</td>
                            {(["arxiv", "semantic_scholar", "google_scholar"] as const).map((src) => {
                              const st = run.progress.fetch?.[src]?.[d];
                              return (
                                <td
                                  key={src}
                                  className={`py-1.5 pr-3 ${st?.status === "failed" || st?.status === "timed_out" ? "text-warn" : "text-muted"}`}
                                  title={st?.error}
                                >
                                  {fetchLabel(st)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-xs text-muted">
                      {counts.papers} links gathered, {counts.unique_papers} unique papers after merge and dedupe.
                    </p>
                  </div>
                )}

                {step.key === "score" && s !== "waiting" && (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-white/5" aria-hidden>
                      <div
                        className="h-1.5 rounded-full bg-accent-2"
                        style={{ width: `${counts.unique_papers ? (counts.scored / counts.unique_papers) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {counts.scored} of {counts.unique_papers} papers scored
                    </p>
                  </div>
                )}

                {step.key === "select" && run.progress.select && (
                  <p className="mt-1 text-xs text-muted">
                    {run.progress.select.featured} featured, {run.progress.select.runner_up} runner-ups
                    {run.progress.select.quiet.length ? `, quiet: ${run.progress.select.quiet.join(", ")}` : ""}
                  </p>
                )}

                {step.key === "write" && run.progress.write && (
                  <p className="mt-1 text-xs text-muted">
                    {run.progress.write.done} of {run.progress.write.total} cards written · news:{" "}
                    {run.progress.write.news === "done"
                      ? `${counts.news} items`
                      : run.progress.write.news === "none"
                        ? "no notable news this week"
                        : run.progress.write.news}
                    {run.word_count ? ` · ${run.word_count} words, ${run.read_minutes} min read` : ""}
                  </p>
                )}

                {step.key === "deliver" && run.progress.deliver && (
                  <p className="mt-1 text-xs text-muted">
                    PDF rendered · email {run.progress.deliver.email}
                    {run.progress.deliver.email_error ? `: ${run.progress.deliver.email_error}` : ""}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {run.progress.deliver?.email === "failed" && (
        <button
          className="btn mt-4"
          disabled={driving}
          onClick={async () => {
            await fetch(`/api/runs/${runId}/deliver`, { method: "POST" });
            refresh();
          }}
        >
          Send the email again
        </button>
      )}

      {run.log.length > 0 && (
        <details className="card mt-4">
          <summary className="cursor-pointer text-sm">Run log ({run.log.length})</summary>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {run.log.map((l, i) => (
              <li key={i}>
                {fmtDate(l.at, true)}: {l.msg}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
