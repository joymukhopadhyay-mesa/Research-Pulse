import Link from "next/link";
import { KeywordForm } from "@/components/KeywordForm";
import { CoverageDonut, ProfileCard, ScoreBars } from "@/components/RightRail";
import { fmtDate, PageHeader, StatCard, StatusText } from "@/components/ui";
import { one, q } from "@/lib/db";
import type { Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

type RunRow = { id: string; status: string; started_at: string; read_minutes: number | null; error: string | null };

async function load() {
  const topics = await q<Topic>("select * from topics order by created_at, name");
  const runs = await q<RunRow>("select id, status, started_at, read_minutes, error from runs order by started_at desc limit 6");
  const latest = await one<RunRow & { word_count: number | null }>(
    "select id, status, started_at, read_minutes, word_count, error from runs where status = 'ready' order by started_at desc limit 1",
  );
  let coverage: { domain: string; scanned: number; selected: number }[] = [];
  let scores: { title: string; final_score: number; id: string }[] = [];
  if (latest) {
    coverage = await q("select domain, scanned, selected from coverage where run_id = $1 order by scanned desc", [latest.id]);
    scores = await q(
      `select p.title, s.final_score::float as final_score, b.id from brief_items b join papers p on p.id = b.paper_id
         join scores s on s.paper_id = p.id where b.run_id = $1 and b.kind = 'featured' order by s.final_score desc limit 6`,
      [latest.id],
    );
  }
  return { topics, runs, latest, coverage, scores };
}

export default async function Overview() {
  let data: Awaited<ReturnType<typeof load>>;
  try {
    data = await load();
  } catch (e) {
    return (
      <div className="card max-w-xl">
        <h1 className="text-lg font-semibold">The database is not reachable</h1>
        <p className="mt-2 text-sm text-muted">{(e as Error).message}</p>
        <p className="mt-2 text-sm text-muted">Check DATABASE_URL in your environment variables, then reload.</p>
      </div>
    );
  }
  const { topics, runs, latest, coverage, scores } = data;
  const scanned = coverage.reduce((n, c) => n + c.scanned, 0);
  const featured = coverage.reduce((n, c) => n + c.selected, 0);
  const active = topics.filter((t) => t.active);

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <div className="min-w-0 flex-1">
        <PageHeader
          title="Overview"
          sub={latest ? `Latest brief: ${fmtDate(latest.started_at, true)}` : "No briefs yet. Enter your keywords to run the first one."}
        >
          {latest && (
            <Link href={`/briefs/${latest.id}`} className="btn">
              Open latest brief
            </Link>
          )}
        </PageHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <StatCard hero label="Papers scanned" value={latest ? String(scanned) : "–"} hint="Across all sources, last brief" />
          <StatCard label="Featured papers" value={latest ? String(featured) : "–"} />
          <StatCard label="Read time" value={latest?.read_minutes ? `${latest.read_minutes} min` : "–"} />
          <StatCard label="Domains monitored" value={String(active.length)} />
        </div>

        <section id="new-brief" className="card mt-6 scroll-mt-6" aria-labelledby="new-brief-title">
          <h2 id="new-brief-title" className="text-lg font-semibold">
            This week&apos;s keywords
          </h2>
          <p className="mt-1 text-sm text-muted">Prefilled from last week. Edit any line, then run the brief.</p>
          <KeywordForm topics={active} />
        </section>

        <section className="card mt-6" aria-labelledby="recent-title">
          <div className="flex items-center justify-between">
            <h2 id="recent-title" className="text-lg font-semibold">
              Recent runs
            </h2>
            <Link href="/briefs" className="text-sm text-muted hover:text-text">
              All briefs
            </Link>
          </div>
          {runs.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No briefs yet. Enter your keywords to run the first one.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center gap-4 py-3">
                  <Link href={r.status === "ready" ? `/briefs/${r.id}` : `/runs/${r.id}`} className="flex-1 text-sm hover:underline">
                    {fmtDate(r.started_at, true)}
                  </Link>
                  <span className="text-xs text-muted">{r.read_minutes ? `${r.read_minutes} min read` : ""}</span>
                  <StatusText status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="flex w-full flex-col gap-4 xl:w-[240px] xl:shrink-0" aria-label="Summary">
        <ProfileCard />
        <CoverageDonut data={coverage.map((c) => ({ label: c.domain, value: c.scanned }))} />
        <ScoreBars data={scores.map((s) => ({ label: s.title, value: s.final_score }))} />
      </aside>
    </div>
  );
}
