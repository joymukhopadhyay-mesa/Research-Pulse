import { loadBrief } from "@/lib/brief";
import { renderBriefPdf } from "@/lib/pdf";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const brief = await loadBrief(id);
  if (!brief) return new Response("Brief not found.", { status: 404 });
  const pdf = await renderBriefPdf(brief);
  const date = new Date(brief.run.started_at).toISOString().slice(0, 10);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // ?view=1 opens the PDF in the browser instead of downloading it.
      "Content-Disposition": `${new URL(req.url).searchParams.has("view") ? "inline" : "attachment"}; filename="research-pulse-${date}.pdf"`,
    },
  });
}
