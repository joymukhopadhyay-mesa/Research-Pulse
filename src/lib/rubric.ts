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

/* ------------------------------------------------------------------ */
/* Plain-language guide: everything below is parsed from the rubric    */
/* file, so the "How it works" panel always matches the live rubric.   */
/* ------------------------------------------------------------------ */

export type RubricRule = { id: string; title: string | null; body: string };
export type RubricDimension = {
  letter: string;
  name: string;
  weight: number;
  question: string;
  levels: { score: number; text: string; bullets: string[] }[];
};
export type RubricGuide = {
  questions: RubricRule[];
  gate: RubricRule[];
  gateNote: string | null;
  dimensions: RubricDimension[];
  scoring: RubricRule[];
  selection: RubricRule[];
  cardIntro: string | null;
  cardFields: { name: string; text: string }[];
  verdicts: { name: string; text: string }[];
  news: RubricRule[];
  feedback: RubricRule[];
  params: RubricParams;
  example: { shift: number; client_relevance: number; evidence: number; maturity: number; raw: number; max: number; score: number };
  raw: string;
};

const sentence = (s: string) => {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Numbered rules such as "S4. CAPS: Maximum 3 papers..." with their continuation lines. */
function parseRules(text: string, prefix: string): RubricRule[] {
  const out: RubricRule[] = [];
  const start = new RegExp("^\\s*(" + prefix + "\\d+)\\.\\s+(.*)$");
  let cur: RubricRule | null = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(start);
    if (m) {
      const titled = m[2].match(/^([A-Z][A-Z '\-]+):\s*(.*)$/);
      cur = { id: m[1], title: titled ? sentence(titled[1]) : null, body: (titled ? titled[2] : m[2]).trim() };
      out.push(cur);
      continue;
    }
    const t = line.trim();
    if (!cur) continue;
    if (!t || /^[=\-]{5,}$/.test(t) || /^[A-Z]\d+\./.test(t)) {
      cur = null;
      continue;
    }
    cur.body += " " + t;
  }
  return out;
}

function parseDimensions(text: string): RubricDimension[] {
  const blocks = text.split(/^-{20,}\s*$/m);
  const dims: RubricDimension[] = [];
  for (let i = 0; i < blocks.length - 1; i++) {
    const h = blocks[i].match(/^\s*([A-D])\.\s+(.+?)\s+weight x(\d+(?:\.\d+)?)\s*\n\s*(.+)/m);
    if (!h) continue;
    const levels: RubricDimension["levels"] = [];
    for (const line of blocks[i + 1].split(/\r?\n/)) {
      const lv = line.match(/^\s*(\d)\s*=\s*(.*)$/);
      if (lv) {
        levels.push({ score: Number(lv[1]), text: lv[2].trim().replace(/:$/, ""), bullets: [] });
        continue;
      }
      const t = line.trim();
      if (!t || !levels.length) continue;
      const last = levels[levels.length - 1];
      if (t.startsWith("- ")) last.bullets.push(t.slice(2));
      else if (last.bullets.length) last.bullets[last.bullets.length - 1] += " " + t;
      else last.text += " " + t;
    }
    // "…, OR" joins the alternatives in the file; the list itself says that in the UI.
    for (const l of levels) l.bullets = l.bullets.map((b) => b.replace(/,?\s*OR$/, ""));
    dims.push({ letter: h[1], name: sentence(h[2]), weight: Number(h[3]), question: h[4].trim(), levels });
  }
  return dims;
}

function parseCard(text: string) {
  const sec = section(text, "4. LAYER 4", "5. IN THE NEWS");
  const lines = sec.split(/\r?\n/).slice(2);
  const introLines: string[] = [];
  const fields: { name: string; text: string }[] = [];
  const verdicts: { name: string; text: string }[] = [];
  let mode: "intro" | "field" | "verdict" = "intro";
  for (const line of lines) {
    const t = line.trim();
    if (!t || /^[=\-]{5,}$/.test(t)) continue;
    const v = line.match(/^\s+(READ IN FULL|FLAG FOR A CLIENT|KNOW IT EXISTS)\s+-\s+(.*)$/);
    if (v) {
      verdicts.push({ name: v[1], text: v[2].trim() });
      mode = "verdict";
      continue;
    }
    const f = line.match(/^ {2}([A-Z][A-Z' ]*[A-Z])\s{2,}(\S.*)$/);
    if (f) {
      fields.push({ name: sentence(f[1]), text: f[2].trim() });
      mode = "field";
      continue;
    }
    if (mode === "intro") introLines.push(t);
    else if (mode === "verdict") verdicts[verdicts.length - 1].text += " " + t;
    else fields[fields.length - 1].text += " " + t;
  }
  return { cardIntro: introLines.join(" ") || null, cardFields: fields, verdicts };
}

export function rubricGuide(text = readRubric()): RubricGuide {
  const params = rubricParams(text);
  const ex = { shift: 2, client_relevance: 3, evidence: 2, maturity: 1 };
  const w = params.weights;
  const raw = ex.shift * w.shift + ex.client_relevance * w.relevance + ex.evidence * w.evidence + ex.maturity * w.maturity;
  const gateNote = text.match(/RULE:\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/)?.[1].replace(/\s+/g, " ").trim() ?? null;
  return {
    questions: parseRules(section(text, "0. PURPOSE", "1. LAYER 1"), "Q"),
    gate: parseRules(section(text, "1. LAYER 1", "2. LAYER 2"), "G"),
    gateNote,
    dimensions: parseDimensions(text),
    scoring: parseRules(section(text, "SCORING RULES FOR GEMINI", "SCORING OUTPUT FORMAT"), "R"),
    selection: parseRules(section(text, "3. LAYER 3", "4. LAYER 4"), "S"),
    ...parseCard(text),
    news: parseRules(section(text, "5. IN THE NEWS", "6. READ-TIME"), "N"),
    feedback: parseRules(section(text, "7. FEEDBACK", "CHANGE LOG"), "F"),
    params,
    example: { ...ex, raw, max: 3 * (w.shift + w.relevance + w.evidence + w.maturity), score: finalScore(ex, params) },
    raw: text,
  };
}
