import { Resend } from "resend";
import { loadBrief } from "../brief";
import { q } from "../db";
import { renderBriefPdf } from "../pdf";
import { getRun, logRun, patchProgress } from "../runs";

export async function deliverStep(runId: string) {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found.");
  if (run.step !== "deliver" && run.step !== "done") throw new Error("Write the brief before delivering it.");
  if (run.emailed_at) return run.progress.deliver;

  const brief = (await loadBrief(runId))!;
  const pdf = await renderBriefPdf(brief);
  const state = { pdf: true, email: "pending" as "pending" | "sent" | "skipped" | "failed", email_error: undefined as string | undefined };

  const key = process.env.RESEND_API_KEY;
  const to = process.env.BRIEF_RECIPIENT_EMAIL;
  if (!key || !to) {
    state.email = "skipped";
    state.email_error = !key ? "RESEND_API_KEY is not set." : "BRIEF_RECIPIENT_EMAIL is not set.";
  } else {
    const date = new Date(run.started_at).toISOString().slice(0, 10);
    const appUrl = process.env.APP_URL?.replace(/\/$/, "");
    const featured = brief.sections.reduce((n, s) => n + s.cards.length, 0);
    const { error } = await new Resend(key).emails.send({
      from: process.env.RESEND_FROM || "Research Pulse <onboarding@resend.dev>",
      to: to.split(",").map((x) => x.trim()),
      subject: `Research Pulse: your brief for ${date}`,
      text: [
        `Your research brief is ready: ${featured} papers across ${brief.sections.length} domains, ${run.read_minutes ?? "?"} minute read.`,
        appUrl ? `Read it online: ${appUrl}/briefs/${runId}` : "",
        "The PDF is attached.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      attachments: [{ filename: `research-pulse-${date}.pdf`, content: pdf }],
    });
    if (error) {
      state.email = "failed";
      state.email_error = `Email was not sent: ${error.message}`;
    } else {
      state.email = "sent";
      await q("update runs set emailed_at = now() where id = $1", [runId]);
    }
  }

  if (state.email_error) await logRun(runId, state.email_error);
  await patchProgress(runId, "deliver", state);
  await q("update runs set status = 'ready', step = 'done', finished_at = coalesce(finished_at, now()) where id = $1", [runId]);
  return state;
}
