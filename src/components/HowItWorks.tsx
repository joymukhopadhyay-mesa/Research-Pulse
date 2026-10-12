"use client";

import { useEffect, useRef, useState } from "react";
import type { RubricGuide, RubricRule } from "@/lib/rubric";
import { IconClose, IconInfo } from "./icons";
import { VERDICT_STYLE } from "./ui";

// Categorical slots 1-4, validated against the --surface card colour (dark). Fixed order.
const DIM_COLOURS = ["#3987e5", "#d95926", "#199e70", "#c98500"];

function Rules({ rules }: { rules: RubricRule[] }) {
  return (
    <ul className="space-y-3">
      {rules.map((r) => (
        <li key={r.id} className="flex gap-3">
          <span className="mt-0.5 h-6 min-w-9 rounded-md bg-white/5 px-1.5 text-center text-xs leading-6 tabular-nums text-muted">
            {r.id}
          </span>
          <p className="text-sm leading-relaxed">
            {r.title && <span className="font-medium">{r.title}. </span>}
            <span className="text-muted">{r.body}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

function Section({ n, title, who, children }: { n?: string; title: string; who?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-6">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold">
          {n && <span className="mr-2 tabular-nums text-accent-2">{n}</span>}
          {title}
        </h3>
        {who && <span className="text-xs text-muted">{who}</span>}
      </div>
      {children}
    </section>
  );
}

function Panel({ g }: { g: RubricGuide }) {
  const w = g.params.weights;
  const weights = g.dimensions.map((d) => d.weight);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const ex = g.example;
  const exampleDims = [ex.shift, ex.client_relevance, ex.evidence, ex.maturity];

  return (
    <div className="space-y-6 text-sm">
      <p className="text-muted">
        Every paper Research Pulse finds goes through four layers. Gemini judges each paper against the rubric. The app does
        the arithmetic and picks what makes the brief, so the same scores always give the same brief.
      </p>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Gate", "Does it belong?", "Gemini"],
          ["Score", "Four 0–3 scores", "Gemini, then code"],
          ["Select", "What makes the brief", "Code"],
          ["Write", "One card per paper", "Gemini"],
        ].map(([t, d, who], i) => (
          <li key={t} className="rounded-xl border border-line bg-surface-2 p-3">
            <p className="text-xs tabular-nums text-accent-2">Layer {i + 1}</p>
            <p className="mt-1 font-medium">{t}</p>
            <p className="text-xs text-muted">{d}</p>
            <p className="mt-2 text-xs text-muted">{who}</p>
          </li>
        ))}
      </ol>

      {g.questions.length > 0 && (
        <Section title="The three client questions">
          <p className="mb-3 text-muted">Relevance is always judged against what Kavita&apos;s clients ask her.</p>
          <Rules rules={g.questions.map((q) => ({ ...q, title: null }))} />
        </Section>
      )}

      <Section n="1" title="Gate: does the paper belong here?" who="Gemini, plus one check in code">
        <p className="mb-3 text-muted">A paper is dropped only if it clearly fails one of these.</p>
        <Rules rules={g.gate} />
        {g.gateNote && (
          <p className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-3">
            <span className="font-medium">When unsure, keep it. </span>
            <span className="text-muted">{g.gateNote}</span>
          </p>
        )}
      </Section>

      <Section n="2" title="Score: four dimensions, 0 to 3 each" who="Gemini reads only the title and abstract">
        <div className="space-y-4">
          {g.dimensions.map((d, i) => (
            <div key={d.letter} className="rounded-xl border border-line bg-surface-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: DIM_COLOURS[i] }} aria-hidden />
                    {d.name}
                  </p>
                  <p className="mt-0.5 text-muted">{d.question}</p>
                </div>
                <span className="shrink-0 rounded-md bg-white/5 px-2 py-0.5 text-xs tabular-nums">weight ×{d.weight}</span>
              </div>
              <ol className="mt-3 space-y-2">
                {d.levels.map((l) => (
                  <li key={l.score} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/5 text-xs tabular-nums">{l.score}</span>
                    <div className="text-muted">
                      {l.text}
                      {l.bullets.length > 0 && (
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">
                          {l.bullets.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      )}
                      {l.bullets.length > 1 && <p className="mt-1 text-xs">Any one of these counts.</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <p className="font-medium">How much each dimension counts</p>
          <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Share of the final score by dimension">
            {g.dimensions.map((d, i) => (
              <div key={d.letter} style={{ width: `${(d.weight / totalWeight) * 100}%`, background: DIM_COLOURS[i] }} />
            ))}
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {g.dimensions.map((d, i) => (
              <li key={d.letter} className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: DIM_COLOURS[i] }} aria-hidden />
                <span className="text-muted">{d.name}</span>
                <span className="ml-auto tabular-nums">{Math.round((d.weight / totalWeight) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 rounded-xl border border-line bg-surface-2 p-4">
          <p className="font-medium">The final score is calculated by the app, never by Gemini</p>
          <p className="mt-2 tabular-nums text-muted">
            (shift × {w.shift} + relevance × {w.relevance} + evidence × {w.evidence} + maturity × {w.maturity}) ÷ {ex.max} × 10,
            rounded to one decimal place.
          </p>
          <p className="mt-3 font-medium">Worked example</p>
          <p className="mt-1 tabular-nums text-muted">
            Shift {ex.shift}, relevance {ex.client_relevance}, evidence {ex.evidence}, maturity {ex.maturity}
          </p>
          <p className="tabular-nums text-muted">
            ({exampleDims.map((v, i) => `${v} × ${weights[i] ?? "?"}`).join(" + ")}) = {ex.raw} → {ex.raw} ÷ {ex.max} × 10 ={" "}
            <span className="text-text">{ex.score.toFixed(1)}</span>
          </p>
          <p className="mt-1 text-muted">
            {ex.score >= g.params.bar
              ? `That clears the ${g.params.bar.toFixed(1)} bar, so the paper qualifies for the brief.`
              : `That is below the ${g.params.bar.toFixed(1)} bar.`}
          </p>
        </div>

        {g.scoring.length > 0 && (
          <div className="mt-5">
            <p className="mb-3 font-medium">Rules Gemini must follow when scoring</p>
            <Rules rules={g.scoring} />
          </div>
        )}
      </Section>

      <Section n="3" title="Select: what makes the brief" who="Code, applied the same way every week">
        <Rules rules={g.selection} />
      </Section>

      <Section n="4" title="Write: one card per paper" who="Gemini, using only the paper's own abstract">
        {g.cardIntro && <p className="mb-3 text-muted">{g.cardIntro}</p>}
        <dl className="space-y-2">
          {g.cardFields
            .filter((f) => f.name !== "Verdict")
            .map((f) => (
              <div key={f.name} className="grid gap-1 sm:grid-cols-[120px_1fr]">
                <dt className="font-medium">{f.name}</dt>
                <dd className="text-muted">{f.text}</dd>
              </div>
            ))}
        </dl>
        <p className="mb-2 mt-4 font-medium">Every card ends with exactly one verdict</p>
        <ul className="space-y-2">
          {g.verdicts.map((v) => {
            const style = VERDICT_STYLE[v.name];
            return (
              <li key={v.name} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: style?.color }} aria-hidden />
                <span className="w-36 shrink-0 font-medium">{style?.label ?? v.name}</span>
                <span className="text-muted">{v.text}</span>
              </li>
            );
          })}
        </ul>
      </Section>

      {g.news.length > 0 && (
        <Section title="In the news" who="Gemini with Google Search grounding">
          <Rules rules={g.news} />
        </Section>
      )}

      <Section title="Read time" who="Counted by the app">
        <p className="text-muted">
          Read time assumes {g.params.wordsPerMinute} words per minute. The brief has a hard limit of{" "}
          {g.params.wordLimit.toLocaleString("en-GB")} words, which is{" "}
          {Math.ceil(g.params.wordLimit / g.params.wordsPerMinute)} minutes. If it runs over, the lowest-scored paper that
          isn&apos;t a must-see moves to the runner-ups, and the count is redone until it fits. The appendix isn&apos;t
          counted.
        </p>
      </Section>

      {g.feedback.length > 0 && (
        <Section title="Your ratings tune the rubric">
          <Rules rules={g.feedback} />
        </Section>
      )}

      <Section title="The full rubric">
        <details className="rounded-xl border border-line bg-surface-2">
          <summary className="cursor-pointer p-3">Show prompts/Research_rubric.txt</summary>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-line p-3 text-xs leading-relaxed text-muted">
            {g.raw}
          </pre>
        </details>
        <p className="mt-3 text-xs text-muted">
          Everything in this panel is read from that file. Edit the file and the next brief, and this panel, follow it.
        </p>
      </Section>
    </div>
  );
}

export function HowItWorks({ guide }: { guide: RubricGuide }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = trigger.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      // Keep keyboard focus inside the panel while it is open.
      const items = panel.current.querySelectorAll<HTMLElement>("button, a[href], summary, [tabindex]:not([tabindex='-1'])");
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={trigger} type="button" className="btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <IconInfo /> How it works
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close how it works" tabIndex={-1} className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-title"
            className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-surface sm:w-[600px]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <div>
                <h2 id="how-title" className="text-lg font-semibold">
                  How the rubric works
                </h2>
                <p className="text-xs text-muted">How a paper earns its place in your brief</p>
              </div>
              <button ref={closeBtn} type="button" className="btn p-2" aria-label="Close" onClick={() => setOpen(false)}>
                <IconClose />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <Panel g={guide} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
