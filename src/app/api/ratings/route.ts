import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { q } from "@/lib/db";

/** F1: one rating per card; it joins to the paper's four dimension scores through brief_items -> scores. */
export async function POST(req: Request) {
  const { briefItemId, useful } = (await req.json().catch(() => ({}))) as { briefItemId?: string; useful?: boolean };
  if (!briefItemId || typeof useful !== "boolean") return jsonError("Send briefItemId and useful.");
  try {
    await q(
      `insert into ratings (brief_item_id, useful) values ($1, $2)
       on conflict (brief_item_id) do update set useful = excluded.useful, created_at = now()`,
      [briefItemId, useful],
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
}
