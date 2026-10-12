import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { one, q } from "@/lib/db";
import type { Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Creates a run from this week's keywords. Saved keywords prefill next week's form. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { topics?: { id: string; keywords: string[] }[] };
  try {
    for (const t of body.topics ?? []) {
      const keywords = [...new Set((t.keywords ?? []).map((k) => k.trim()).filter(Boolean))];
      if (keywords.length) await q("update topics set keywords = $2 where id = $1", [t.id, keywords]);
    }
    const topics = await q<Topic>("select * from topics where active order by created_at, name");
    const domains = topics
      .filter((t) => t.keywords.length)
      .map((t) => ({ name: t.name, keywords: t.keywords, arxiv_categories: t.arxiv_categories }));
    if (!domains.length) return jsonError("Add at least one domain with keywords on the Topics page first.");

    // A double click should not start two runs.
    const active = await one<{ id: string }>(
      `select id from runs where status not in ('ready','failed') and started_at > now() - interval '20 minutes'
        order by started_at desc limit 1`,
    );
    if (active) return NextResponse.json({ runId: active.id, status: "fetching", reused: true });

    const run = await one<{ id: string }>(
      `insert into runs (status, step, domains) values ('fetching', 'fetch', $1::jsonb) returning id`,
      [JSON.stringify(domains)],
    );
    return NextResponse.json({ runId: run!.id, status: "fetching" });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
}

export async function GET() {
  const runs = await q(
    `select id, status, step, started_at, finished_at, read_minutes, word_count, error from runs order by started_at desc limit 30`,
  );
  return NextResponse.json({ runs });
}
