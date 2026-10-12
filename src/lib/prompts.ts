/**
 * Prompt scaffolding only. Every scoring and writing criterion comes from prompts/Research_rubric.txt,
 * which is injected verbatim. Nothing here defines what makes a paper important.
 */
import { newsRubric, scoringRubric, writingRubric } from "./rubric";
import type { Domain } from "./types";

export function scoringPrompt(domains: Domain[], papers: { paper_id: string; source: string; title: string; abstract: string }[]) {
  const system = [
    "You are the scoring pass (Layer 1 gate and Layer 2 scoring) of Research Pulse.",
    "Apply the rubric below exactly as written. Return JSON only, in the response schema.",
    "",
    "===== RUBRIC (verbatim) =====",
    scoringRubric(),
    "===== END RUBRIC =====",
    "",
    "Output notes:",
    '- Return one object per paper in "results", using the paper_id you were given.',
    "- domains: names from Kavita's domain list below, spelled exactly as given, ordered from the domain where the paper has the highest client relevance to the lowest.",
    '- gate_reason: an empty string when gate_pass is true.',
    '- client_questions: an empty array means "none".',
    "- proof quotes must be copied from the abstract, not paraphrased.",
  ].join("\n");

  const user = [
    "Kavita's domains:",
    ...domains.map((d) => `- ${d.name} (keywords: ${d.keywords.join(", ")})`),
    "",
    "Papers to score:",
    JSON.stringify(papers, null, 1),
  ].join("\n");
  return { system, user };
}

const int03 = { type: "integer", description: "0 to 3" };
export const SCORING_SCHEMA = {
  name: "paper_scores",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "paper_id",
            "gate_pass",
            "gate_reason",
            "domains",
            "shift",
            "shift_type",
            "client_relevance",
            "client_questions",
            "evidence",
            "maturity",
            "proof",
            "uncertain",
            "one_line_reason",
          ],
          properties: {
            paper_id: { type: "string" },
            gate_pass: { type: "boolean" },
            gate_reason: { type: "string" },
            domains: { type: "array", items: { type: "string" } },
            shift: int03,
            shift_type: { type: "array", items: { type: "string", enum: ["new_benchmark", "surprising_result", "reframing"] } },
            client_relevance: int03,
            client_questions: { type: "array", items: { type: "string", enum: ["Q1", "Q2", "Q3"] } },
            evidence: int03,
            maturity: int03,
            proof: {
              type: "object",
              additionalProperties: false,
              required: ["shift", "client_relevance", "evidence", "maturity"],
              properties: {
                shift: { type: "string" },
                client_relevance: { type: "string" },
                evidence: { type: "string" },
                maturity: { type: "string" },
              },
            },
            uncertain: { type: "boolean" },
            one_line_reason: { type: "string" },
          },
        },
      },
    },
  },
};

export type ScoreResult = {
  paper_id: string;
  gate_pass: boolean;
  gate_reason: string;
  domains: string[];
  shift: number;
  shift_type: string[];
  client_relevance: number;
  client_questions: string[];
  evidence: number;
  maturity: number;
  proof: { shift: string; client_relevance: string; evidence: string; maturity: string };
  uncertain: boolean;
  one_line_reason: string;
};

export function writingPrompt(
  items: {
    brief_item_id: string;
    domain: string;
    title: string;
    source: string;
    preprint: boolean;
    abstract: string;
    scores: Record<string, unknown>;
  }[],
) {
  const system = [
    "You are the writing pass (Layer 4) of Research Pulse. Write one card per paper, following the rubric below exactly.",
    "Write only from the title, abstract and scores you are given. Do not add facts, numbers or sources that are not in them.",
    "Never write a URL or a link. Links are added by the application from source data.",
    "Return JSON only, in the response schema.",
    "",
    "===== RUBRIC (verbatim) =====",
    writingRubric(),
    "===== END RUBRIC =====",
    "",
    "Output notes:",
    "- One object per paper, using the brief_item_id you were given.",
    "- whats_new, why_it_matters, client_angle and evidence_note together must stay within the card word limit.",
    '- When "preprint" is true, evidence_note must include the words "Preprint, not yet peer-reviewed".',
    '- verdict is exactly one of "READ IN FULL", "FLAG FOR A CLIENT", "KNOW IT EXISTS".',
  ].join("\n");
  return { system, user: JSON.stringify(items, null, 1) };
}

export const WRITING_SCHEMA = {
  name: "paper_cards",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["cards"],
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["brief_item_id", "whats_new", "why_it_matters", "client_angle", "evidence_note", "verdict"],
          properties: {
            brief_item_id: { type: "string" },
            whats_new: { type: "string" },
            why_it_matters: { type: "string" },
            client_angle: { type: "string" },
            evidence_note: { type: "string" },
            verdict: { type: "string", enum: ["READ IN FULL", "FLAG FOR A CLIENT", "KNOW IT EXISTS"] },
          },
        },
      },
    },
  },
};

export type CardResult = {
  brief_item_id: string;
  whats_new: string;
  why_it_matters: string;
  client_angle: string;
  evidence_note: string;
  verdict: string;
};

export function newsSearchPrompt(domains: Domain[], since: string) {
  return [
    `Search the web for notable AI and machine learning research news published since ${since}.`,
    "Focus on these research domains:",
    ...domains.map((d) => `- ${d.name}: ${d.keywords.join(", ")}`),
    "Prefer reporting on specific new papers, benchmarks, evaluations and research releases over product marketing.",
    "Summarise the 5 to 8 most notable stories you find, one short paragraph each, and cite your sources.",
  ].join("\n");
}

export function newsWritePrompt(
  results: { index: number; title: string; snippet: string; site: string }[],
  papers: { paper_id: string; title: string; domain: string }[],
  groundedSummary: string,
) {
  const system = [
    "You turn grounded search results into the 'In the news' section of Research Pulse, following these rules exactly:",
    "",
    newsRubric(),
    "",
    "Each news item must be based on exactly one of the numbered search results; return that result's index as source_index.",
    "Use only facts present in that result or in the grounded summary. Never write a URL.",
    "related_paper_id: if the item is about one of the brief's papers listed below, give that paper_id; otherwise an empty string.",
    "If no search result is notable research news, return an empty items array.",
  ].join("\n");
  const user = [
    "Grounded summary:",
    groundedSummary,
    "",
    "Search results:",
    JSON.stringify(results, null, 1),
    "",
    "Papers already in the brief:",
    JSON.stringify(papers, null, 1),
  ].join("\n");
  return { system, user };
}

export const NEWS_SCHEMA = {
  name: "news_items",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["source_index", "headline", "summary", "related_paper_id"],
          properties: {
            source_index: { type: "integer" },
            headline: { type: "string" },
            summary: { type: "string" },
            related_paper_id: { type: "string" },
          },
        },
      },
    },
  },
};
