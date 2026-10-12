import { NextResponse } from "next/server";
import { fetchStep } from "@/lib/pipeline/fetch";
import { SOURCES, type Source } from "@/lib/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** One source for one domain per call. Errors are recorded per source; the run carries on without it. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { source, domain } = (await req.json().catch(() => ({}))) as { source?: Source; domain?: string };
  if (!source || !SOURCES.includes(source) || !domain) {
    return NextResponse.json({ error: "Send a source and a domain." }, { status: 400 });
  }
  try {
    return NextResponse.json(await fetchStep(id, source, domain));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
