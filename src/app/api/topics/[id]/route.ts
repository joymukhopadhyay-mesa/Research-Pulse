import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { one, q } from "@/lib/db";

const list = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))] : null;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : null;
  if (name === "") return jsonError("A domain needs a name.");
  try {
    const topic = await one(
      `update topics set name = coalesce($2, name), keywords = coalesce($3, keywords),
              arxiv_categories = coalesce($4, arxiv_categories), active = coalesce($5, active)
        where id = $1 returning *`,
      [id, name, list(b.keywords), list(b.arxiv_categories), typeof b.active === "boolean" ? b.active : null],
    );
    if (!topic) return jsonError("Domain not found.", 404);
    return NextResponse.json({ topic });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await q("delete from topics where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
