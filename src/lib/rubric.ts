import fs from "fs";
import path from "path";

/**
 * The rubric file is the single source of scoring criteria.
 * It is read from disk on every call so edits apply to the next run with no redeploy of code logic.
 * Numeric parameters (weights, bar, floor, caps, word budget) are parsed from the file's text;
 * the defaults below are only used if a line cannot be found, and that is reported to the run log.
 */
const RUBRIC_PATH = path.join(process.cwd(), "prompts", "Research_rubric.txt");

export function readRubric(): string {
  return fs.readFileSync(RUBRIC_PATH, "utf8");
}

export type RubricParams = {
  weights: { shift: number; relevance: number; evidence: number; maturity: number };
  bar: number;
  floor: number;
  perDomainCap: number;
  totalCap: number;
  runnerUpsPerDomain: number;
  wordsPerMinute: number;
  wordLimit: number;
  cardMaxWords: number;
  warnings: string[];
};

function section(text: string, startMarker: string, endMarker?: string): string {
  const s = text.indexOf(startMarker);
  if (s < 0) return "";
  const e = endMarker ? text.indexOf(endMarker, s + startMarker.length) : -1;
  return e < 0 ? text.slice(s) : text.slice(s, e);
}

export function rubricParams(text = readRubric()): RubricParams {
  const warnings: string[] = [];
  const num = (re: RegExp, fallback: number, label: string) => {
    const m = text.match(re);
    if (!m) {
      warnings.push(`Rubric: could not read ${label}; using ${fallback}.`);
      return fallback;
    }
    return Number(m[1].replace(",", ""));
  };
  return {
    weights: {
      shift: num(/SHIFT SIGNAL\s+weight x(\d+(?:\.\d+)?)/i, 3, "shift weight"),
      relevance: num(/CLIENT RELEVANCE\s+weight x(\d+(?:\.\d+)?)/i, 2, "client relevance weight"),
      evidence: num(/EVIDENCE STRENGTH\s+weight x(\d+(?:\.\d+)?)/i, 2, "evidence weight"),
      maturity: num(/PRACTICAL MATURITY\s+weight x(\d+(?:\.\d+)?)/i, 1, "maturity weight"),
    },
    bar: num(/S1\.\s*BAR:\s*Papers scoring (\d+(?:\.\d+)?)/i, 7.0, "S1 bar"),
    floor: num(/S2\.\s*DOMAIN FLOOR:[\s\S]*?scores (\d+(?:\.\d+)?) or higher/i, 5.0, "S2 floor"),
    perDomainCap: num(/S4\.\s*CAPS:\s*Maximum (\d+) papers per domain/i, 3, "S4 per-domain cap"),
    totalCap: num(/S4\.\s*CAPS:[\s\S]*?Maximum (\d+) papers in\s+total/i, 12, "S4 total cap"),
    runnerUpsPerDomain: num(/S7\.\s*RUNNER-UPS:\s*The next (\d+)/i, 2, "S7 runner-up count"),
    wordsPerMinute: num(/Reading speed assumed:\s*(\d+) words per minute/i, 200, "reading speed"),
    wordLimit: num(/Hard limit:\s*([\d,]+) words/i, 2000, "word limit"),
    cardMaxWords: num(/Maximum (\d+) words per card/i, 120, "card word limit"),
    warnings,
  };
}

/** raw = sum(dimension x weight); score = round(raw / max x 10, 1). Computed by code, never by the model. */
export function finalScore(
  s: { shift: number; client_relevance: number; evidence: number; maturity: number },
  p: RubricParams,
): number {
  const w = p.weights;
  const raw = s.shift * w.shift + s.client_relevance * w.relevance + s.evidence * w.evidence + s.maturity * w.maturity;
  const max = 3 * (w.shift + w.relevance + w.evidence + w.maturity);
  return Math.round((raw / max) * 10 * 10) / 10;
}

/** Sections handed to Gemini for the scoring pass: purpose, gate and scoring layers. */
export function scoringRubric(text = readRubric()): string {
  return [
    section(text, "0. PURPOSE", "1. LAYER 1"),
    section(text, "1. LAYER 1", "3. LAYER 3"),
  ].join("\n");
}

/** Sections handed to Gemini for the writing pass. */
export function writingRubric(text = readRubric()): string {
  return [section(text, "0. PURPOSE", "1. LAYER 1"), section(text, "4. LAYER 4", "5. IN THE NEWS")].join("\n");
}

export function newsRubric(text = readRubric()): string {
  return section(text, "5. IN THE NEWS", "6. READ-TIME");
}
