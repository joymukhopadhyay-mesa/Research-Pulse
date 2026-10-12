import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { one, q } from "@/lib/db";

export const dynamic = "force-dynamic";

const list = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))] : [];

export async function GET() {
  return NextResponse.json({ topics: await q("select * from topics order by created_at, name") });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) return jsonError("Give the domain a name.");
  try {
    const topic = await one(
      `insert into topics (name, keywords, arxiv_categories) values ($1, $2, $3) returning *`,
      [name, list(b.keywords), list(b.arxiv_categories)],
    );
    return NextResponse.json({ topic });
  } catch (e) {
    const msg = (e as Error).message;
    return jsonError(msg.includes("duplicate") ? `A domain called "${name}" already exists.` : msg, 400);
  }
}
