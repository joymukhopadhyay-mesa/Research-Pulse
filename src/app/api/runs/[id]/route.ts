import { NextResponse } from "next/server";
import { one, q } from "@/lib/db";
import { getRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  const counts = await one(
    `select
       (select count(*)::int from papers where run_id = $1) as papers,
       (select count(*)::int from papers where run_id = $1 and dup_of is null) as unique_papers,
       (select count(*)::int from scores s join papers p on p.id = s.paper_id where p.run_id = $1) as scored,
       (select count(*)::int from brief_items where run_id = $1 and kind = 'featured') as featured,
       (select count(*)::int from news_items where run_id = $1) as news`,
    [id],
  );
  return NextResponse.json({ run, counts });
}

const STATUS_FOR_STEP: Record<string, string> = {
  fetch: "fetching",
  score: "scoring",
  select: "scoring", // "selecting" is the select step's own claim marker
  write: "writing",
  deliver: "delivering",
  done: "ready",
};

/** Clears a failed step so the client can retry it. */
export async function PATCH(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  // A news call that died mid-request leaves its claim behind; release it so the retry can run it.
  await q(
    `update runs set status = $2, error = null,
            progress = case when progress->'write'->>'news' = 'running'
                            then jsonb_set(progress, '{write,news}', '"failed"') else progress end
      where id = $1`,
    [id, STATUS_FOR_STEP[run.step] ?? "fetching"],
  );
  return NextResponse.json({ ok: true });
}
