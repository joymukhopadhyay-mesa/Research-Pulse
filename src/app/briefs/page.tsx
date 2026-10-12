import Link from "next/link";
import { fmtDate, PageHeader, StatusText } from "@/components/ui";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  status: string;
  started_at: string;
  read_minutes: number | null;
  featured: number;
  domains: number;
  matches: string[] | null;
};

export default async function Archive({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: query } = await searchParams;
  const term = query?.trim() || null;
  const rows = await q<Row>(
    `select r.id, r.status, r.started_at, r.read_minutes,
            (select count(*)::int from brief_items b where b.run_id = r.id and b.kind = 'featured') as featured,
            jsonb_array_length(r.domains) as domains,
            case when $1::text is null then null else
              (select array_agg(p.title) from brief_items b join papers p on p.id = b.paper_id
                where b.run_id = r.id and p.title ilike '%' || $1 || '%') end as matches
       from runs r
      where $1::text is null or exists (
        select 1 from brief_items b join papers p on p.id = b.paper_id where b.run_id = r.id and p.title ilike '%' || $1 || '%')
      order by r.started_at desc limit 100`,
    [term],
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title="Briefs" sub={term ? `Briefs with papers matching "${term}"` : "Past briefs by date"}>
        {term && (
          <Link href="/briefs" className="btn">
            Clear search
          </Link>
        )}
      </PageHeader>
      {rows.length === 0 ? (
        <div className="card text-sm text-muted">
          {term ? (
            `No brief has a paper matching "${term}".`
          ) : (
            <>
              No briefs yet.{" "}
              <Link href="/#new-brief" className="text-text underline">
                Enter your keywords to run the first one.
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className="card divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
              <Link href={r.status === "ready" ? `/briefs/${r.id}` : `/runs/${r.id}`} className="min-w-40 flex-1 text-sm font-medium hover:underline">
                Week of {fmtDate(r.started_at)}
              </Link>
              <span className="text-xs text-muted">
                {r.featured} papers · {r.domains} domains{r.read_minutes ? ` · ${r.read_minutes} min read` : ""}
              </span>
              <StatusText status={r.status} />
              {r.matches && (
                <ul className="w-full text-xs text-muted">
                  {r.matches.slice(0, 3).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
