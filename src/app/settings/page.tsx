import { PageHeader } from "@/components/ui";
import { rubricParams } from "@/lib/rubric";

export const dynamic = "force-dynamic";

const CHECKS: { key: string; label: string; needed: string }[] = [
  { key: "DATABASE_URL", label: "Neon database", needed: "Required" },
  { key: "OPENROUTER_API_KEY", label: "Gemini Flash via OpenRouter", needed: "Required" },
  { key: "APIFY_TOKEN", label: "Google Scholar via Apify", needed: "Optional: skipped if missing" },
  { key: "RESEND_API_KEY", label: "Resend email", needed: "Optional: PDF still downloads" },
  { key: "BRIEF_RECIPIENT_EMAIL", label: "Brief recipient", needed: "Needed for email" },
];

export default function Settings() {
  let params: ReturnType<typeof rubricParams> | null = null;
  let rubricError: string | null = null;
  try {
    params = rubricParams();
  } catch (e) {
    rubricError = (e as Error).message;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" sub="Configuration is read from environment variables. Values are never shown here." />

      <section className="card" aria-labelledby="conn">
        <h2 id="conn" className="text-lg font-semibold">
          Connections
        </h2>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {CHECKS.map((c) => {
            const ok = Boolean(process.env[c.key]);
            return (
              <li key={c.key} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex-1 text-sm">
                  {c.label} <span className="block text-xs text-muted">{c.key}</span>
                </span>
                <span className="text-xs text-muted">{c.needed}</span>
                <span className={`text-xs ${ok ? "text-good" : "text-warn"}`}>{ok ? "Set" : "Not set"}</span>
              </li>
            );
          })}
          <li className="flex items-center gap-3 py-3">
            <span className="flex-1 text-sm">
              Model <span className="block text-xs text-muted">GEMINI_MODEL</span>
            </span>
            <span className="text-xs">{process.env.GEMINI_MODEL || "google/gemini-3.7-flash"}</span>
          </li>
        </ul>
      </section>

      <section className="card" aria-labelledby="rub">
        <h2 id="rub" className="text-lg font-semibold">
          Rubric in effect
        </h2>
        <p className="mt-1 text-sm text-muted">Read from prompts/Research_rubric.txt on every run.</p>
        {rubricError && <p className="mt-3 text-sm text-danger">{rubricError}</p>}
        {params && (
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            {[
              ["Weights", `shift ×${params.weights.shift}, relevance ×${params.weights.relevance}, evidence ×${params.weights.evidence}, maturity ×${params.weights.maturity}`],
              ["Bar", params.bar.toFixed(1)],
              ["Domain floor", params.floor.toFixed(1)],
              ["Caps", `${params.perDomainCap} per domain, ${params.totalCap} total`],
              ["Runner-ups", `${params.runnerUpsPerDomain} per domain`],
              ["Word limit", `${params.wordLimit} at ${params.wordsPerMinute} wpm`],
            ].map(([k, v]) => (
              <div key={k} className={k === "Weights" ? "col-span-2 sm:col-span-3" : ""}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {params?.warnings.map((w) => (
          <p key={w} className="mt-2 text-xs text-warn">
            {w}
          </p>
        ))}
      </section>
    </div>
  );
}
