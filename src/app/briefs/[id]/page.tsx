import Link from "next/link";
import { notFound } from "next/navigation";
import { IconDownload } from "@/components/icons";
import { RatingButtons } from "@/components/RatingButtons";
import { CoverageDonut, ScoreBars } from "@/components/RightRail";
import { fmtDate, VERDICT_STYLE } from "@/components/ui";
import { loadBrief, type Card } from "@/lib/brief";
import { SOURCE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

function PaperCard({ c }: { c: Card }) {
  const v = VERDICT_STYLE[c.verdict ?? ""];
  const others = (c.tags ?? []).filter((t) => t !== c.domain);
  return (
    <article className="card" aria-labelledby={`t-${c.item_id}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{SOURCE_LABEL[c.source]}</span>
        {c.source === "arxiv" && <span>Preprint, not yet peer-reviewed</span>}
        <span className="tabular-nums">Score {c.final_score.toFixed(1)}</span>
        {c.published_at && <span>{fmtDate(c.published_at)}</span>}
      </div>
      <h3 id={`t-${c.item_id}`} className="mt-2 text-base font-semibold leading-snug">
        <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {c.title}
        </a>
      </h3>
      {others.length > 0 && <p className="mt-1 text-xs text-muted">Also tagged: {others.join(", ")}</p>}

      <dl className="mt-4 space-y-3 text-sm">
        {[
          ["What's new", c.whats_new],
          ["Why it matters", c.why_it_matters],
          ["Client angle", c.client_angle],
          ["Evidence", c.evidence_note],
        ].map(([k, val]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-0.5 leading-relaxed">{val}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {v ? (
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: v.color }} aria-hidden />
            {v.label}
          </span>
        ) : (
          <span />
        )}
        <RatingButtons itemId={c.item_id} initial={c.useful} />
      </div>
      {c.also_on?.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Also found on{" "}
          {c.also_on.map((a, i) => (
            <span key={a.url}>
              {i > 0 && ", "}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="underline">
                {SOURCE_LABEL[a.source]}
              </a>
            </span>
          ))}
        </p>
      )}
    </article>
  );
}

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await loadBrief(id);
  if (!b) notFound();
  const { run } = b;

  if (!["deliver", "done"].includes(run.step)) {
    return (
      <div className="card max-w-xl">
        <h1 className="text-lg font-semibold">This brief is still being built</h1>
        <p className="mt-2 text-sm text-muted">Follow its progress on the run page.</p>
        <Link href={`/runs/${run.id}`} className="btn mt-4">
          Open the run
        </Link>
      </div>
    );
  }

  const featured = b.sections.flatMap((s) => s.cards);
  const totalLinks = b.links.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <div className="min-w-0 flex-1">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Week of {fmtDate(run.started_at)}</p>
            <h1 className="mt-1 text-2xl font-semibold">Research brief</h1>
            <p className="mt-2 text-sm">
              <span className="text-2xl font-light tabular-nums">{run.read_minutes ?? "–"}</span>{" "}
              <span className="text-muted">min read · {featured.length} papers · {b.sections.length} domains</span>
            </p>
          </div>
          <a href={`/api/briefs/${run.id}/pdf`} className="btn btn-primary">
            <IconDownload /> Download PDF
          </a>
        </header>

        <nav aria-label="Domains" className="mb-6 flex flex-wrap gap-2">
          {b.sections.map((s) => (
            <a key={s.domain} href={`#d-${encodeURIComponent(s.domain)}`} className="btn px-3 py-1.5 text-xs">
              {s.domain} <span className="text-muted">{s.cards.length}</span>
            </a>
          ))}
          <a href="#news" className="btn px-3 py-1.5 text-xs">
            In the news
          </a>
          <a href="#appendix" className="btn px-3 py-1.5 text-xs">
            Appendix
          </a>
        </nav>

        <div className="space-y-10">
          {b.sections.map((s) => (
            <section key={s.domain} id={`d-${encodeURIComponent(s.domain)}`} className="scroll-mt-6" aria-label={s.domain}>
              <h2 className="mb-3 text-lg font-semibold">{s.domain}</h2>
              {s.notice && <p className="card text-sm text-muted">{s.notice}</p>}
              <div className="grid gap-4 2xl:grid-cols-2">
                {s.cards.map((c) => (
                  <PaperCard key={c.item_id} c={c} />
                ))}
              </div>
            </section>
          ))}

          <section id="news" className="scroll-mt-6" aria-label="In the news">
            <h2 className="mb-1 text-lg font-semibold">In the news</h2>
            <p className="mb-3 text-xs text-muted">From Google Search grounding. Not scored, and never changes a paper&apos;s score.</p>
            {b.news.length === 0 ? (
              <p className="card text-sm text-muted">No notable news this week.</p>
            ) : (
              <ul className="card divide-y divide-[var(--border)]">
                {b.news.map((n) => (
                  <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">
                      {n.headline}
                    </a>
                    <p className="mt-1 text-sm text-muted">
                      {n.summary}
                      {n.related_domain && (
                        <>
                          {" "}
                          <a href={`#d-${encodeURIComponent(n.related_domain)}`} className="text-text underline">
                            Covered above in {n.related_domain}.
                          </a>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="appendix" className="scroll-mt-6 space-y-6" aria-label="Appendix">
            <h2 className="text-lg font-semibold">Appendix</h2>

            <div className="card overflow-x-auto">
              <h3 className="text-sm font-medium">Coverage log</h3>
              <table className="mt-3 w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-2 pr-3 font-normal">Domain</th>
                    <th className="py-2 pr-3 font-normal">Scanned</th>
                    <th className="py-2 pr-3 font-normal">By source</th>
                    <th className="py-2 pr-3 font-normal">Gated out</th>
                    <th className="py-2 pr-3 font-normal">Scored</th>
                    <th className="py-2 font-normal">Selected</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {b.coverage.map((c) => (
                    <tr key={c.domain} className="border-t border-line">
                      <td className="py-2 pr-3">{c.domain}</td>
                      <td className="py-2 pr-3">{c.scanned}</td>
                      <td className="py-2 pr-3 text-xs text-muted">
                        {Object.entries(c.by_source ?? {})
                          .map(([s, n]) => `${SOURCE_LABEL[s as keyof typeof SOURCE_LABEL] ?? s} ${n}`)
                          .join(" · ")}
                      </td>
                      <td className="py-2 pr-3">{c.gated_out}</td>
                      <td className="py-2 pr-3">{c.scored}</td>
                      <td className="py-2">{c.selected}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-line font-medium">
                    <td className="py-2 pr-3">Total</td>
                    <td className="py-2 pr-3">{b.coverage.reduce((n, c) => n + c.scanned, 0)}</td>
                    <td />
                    <td className="py-2 pr-3">{b.coverage.reduce((n, c) => n + c.gated_out, 0)}</td>
                    <td className="py-2 pr-3">{b.coverage.reduce((n, c) => n + c.scored, 0)}</td>
                    <td className="py-2">{b.coverage.reduce((n, c) => n + c.selected, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {b.runnerUps.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-medium">Runner-ups ({b.runnerUps.length})</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {b.runnerUps.map((r) => (
                    <li key={r.item_id}>
                      <span className="text-xs text-muted">{r.domain}: </span>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {r.title}
                      </a>
                      {r.uncertain && <span className="text-xs text-muted"> (abstract too vague to judge)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card">
              <h3 className="text-sm font-medium">Every link gathered ({totalLinks})</h3>
              <div className="mt-3 space-y-3">
                {b.links.map((g) => (
                  <details key={g.source}>
                    <summary className="cursor-pointer text-sm">
                      {SOURCE_LABEL[g.source as keyof typeof SOURCE_LABEL] ?? g.source}{" "}
                      <span className="text-muted">({g.items.length})</span>
                    </summary>
                    <ul className="mt-2 space-y-1 pl-4 text-xs">
                      {g.items.map((l, i) => (
                        <li key={i}>
                          <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-text hover:underline">
                            {l.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <aside className="flex w-full flex-col gap-4 xl:w-[240px] xl:shrink-0" aria-label="Brief summary">
        <section className="card" aria-label="Verdict key">
          <h2 className="text-sm font-medium">Verdicts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.values(VERDICT_STYLE).map((v) => (
              <li key={v.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: v.color }} aria-hidden />
                {v.label}
                <span className="ml-auto tabular-nums text-muted">
                  {featured.filter((c) => VERDICT_STYLE[c.verdict ?? ""]?.label === v.label).length}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <CoverageDonut title="Coverage by domain" data={b.coverage.map((c) => ({ label: c.domain, value: c.scanned }))} />
        <ScoreBars data={[...featured].sort((a, z) => z.final_score - a.final_score).slice(0, 6).map((c) => ({ label: c.title, value: c.final_score }))} />
      </aside>
    </div>
  );
}
