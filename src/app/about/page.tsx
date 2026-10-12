import { PageHeader } from "@/components/ui";

const FLOW = [
  ["You enter keywords", "Each domain's keywords are saved, so next week's form is prefilled."],
  ["Four live sources", "arXiv and Semantic Scholar are searched per domain. Google Scholar runs on Apify and is dropped after 90 seconds. Google News comes from one Gemini call with Google Search grounding."],
  ["Merge and dedupe", "The same paper from two sources is kept once and tagged with every domain it matched."],
  ["Gemini scores", "Gemini Flash reads each title and abstract against the rubric and returns four 0–3 scores with proof quotes. The app computes the final score."],
  ["The app selects", "Rules S1–S9 from the rubric: the 7.0 bar, the 5.0 domain floor, caps, must-see papers, runner-ups and the coverage log."],
  ["Gemini writes", "One card per selected paper. Links always come from the source APIs, never from the model."],
  ["Delivery", "The brief appears here, a PDF is rendered, and Resend emails it to you."],
  ["Your ratings", "Useful or not useful on each card is stored with the paper's four scores for monthly rubric tuning."],
];

export default function About() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="About Research Pulse" sub="A Monday research brief you can read in under ten minutes." />
      <ol className="card space-y-4">
        {FLOW.map(([t, d], i) => (
          <li key={t} className="flex gap-4">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/25 text-xs tabular-nums">{i + 1}</span>
            <div>
              <p className="text-sm font-medium">{t}</p>
              <p className="mt-0.5 text-sm text-muted">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">
        Nothing runs on a schedule. A brief is built only when you click Run, and every AI step uses Gemini Flash.
      </p>
    </div>
  );
}
