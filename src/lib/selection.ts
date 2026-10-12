import type { RubricParams } from "./rubric";

/** A scored, gate-passing canonical paper. */
export type Candidate = {
  paper_id: string;
  domains: string[]; // ordered: first = domain where client relevance is highest (S8)
  fetched_domains: string[];
  final_score: number;
  shift: number;
  evidence: number;
  uncertain: boolean;
  published_at: string | null;
};

export type Selection = {
  featured: { paper_id: string; domain: string; rank: number; must_see: boolean }[];
  runnerUps: { paper_id: string; domain: string; rank: number }[];
  quiet: { domain: string; scanned: number }[];
};

export const isMustSee = (c: Pick<Candidate, "shift" | "evidence">) => c.shift === 3 && c.evidence >= 2;

/** S6: higher score -> higher shift -> higher evidence -> earlier publication date. */
export function tieBreak(a: Candidate, b: Candidate) {
  if (b.final_score !== a.final_score) return b.final_score - a.final_score;
  if (b.shift !== a.shift) return b.shift - a.shift;
  if (b.evidence !== a.evidence) return b.evidence - a.evidence;
  const ta = a.published_at ? Date.parse(a.published_at) : Infinity;
  const tb = b.published_at ? Date.parse(b.published_at) : Infinity;
  return ta - tb;
}

/** S8: each paper appears once, under the first of its domains that Kavita monitors. */
export function homeDomain(c: Candidate, domainNames: string[]): string {
  const lower = new Map(domainNames.map((d) => [d.toLowerCase(), d]));
  for (const d of c.domains) {
    const hit = lower.get(d.toLowerCase());
    if (hit) return hit;
  }
  return c.fetched_domains.find((d) => lower.has(d.toLowerCase())) ?? c.fetched_domains[0] ?? domainNames[0];
}

/**
 * Layer 3 of the rubric (S1-S8). Assumptions, noted in the README:
 *  - Must-see papers (S5) are taken first so the 12-paper total can never squeeze them out,
 *    and they bypass the S1 bar as well as the per-domain cap.
 *  - The S2 floor slot is the domain's best paper at or above the floor.
 */
export function selectPapers(
  candidates: Candidate[],
  domainNames: string[],
  p: RubricParams,
  scannedByDomain: Record<string, number>,
): Selection {
  const sorted = [...candidates].sort(tieBreak);
  const home = new Map(sorted.map((c) => [c.paper_id, homeDomain(c, domainNames)]));
  const chosen = new Set<string>();
  const perDomain = new Map<string, number>();
  const featured: Selection["featured"] = [];

  // Must-see papers sit on top of the per-domain cap, so only regular picks count toward it.
  const take = (c: Candidate, viaOverride = false) => {
    const d = home.get(c.paper_id)!;
    chosen.add(c.paper_id);
    if (!viaOverride) perDomain.set(d, (perDomain.get(d) ?? 0) + 1);
    featured.push({ paper_id: c.paper_id, domain: d, rank: 0, must_see: isMustSee(c) });
  };
  const count = (d: string) => perDomain.get(d) ?? 0;

  // S5 must-see override.
  for (const c of sorted) {
    if (featured.length >= p.totalCap) break;
    if (isMustSee(c)) take(c, true);
  }
  // S2 domain floor: best paper >= floor in each domain that has nothing yet.
  for (const d of domainNames) {
    if (featured.length >= p.totalCap) break;
    if (featured.some((f) => f.domain === d)) continue;
    const best = sorted.find((c) => !chosen.has(c.paper_id) && home.get(c.paper_id) === d && c.final_score >= p.floor);
    if (best) take(best);
  }
  // S1 bar + S4 caps.
  for (const c of sorted) {
    if (featured.length >= p.totalCap) break;
    if (chosen.has(c.paper_id) || c.final_score < p.bar) continue;
    if (count(home.get(c.paper_id)!) < p.perDomainCap) take(c);
  }

  // Rank within domain by S6.
  const byPaper = new Map(sorted.map((c) => [c.paper_id, c]));
  for (const d of domainNames) {
    featured
      .filter((f) => f.domain === d)
      .sort((a, b) => tieBreak(byPaper.get(a.paper_id)!, byPaper.get(b.paper_id)!))
      .forEach((f, i) => (f.rank = i + 1));
  }

  // S7 runner-ups: next N per domain, plus every uncertain paper scoring >= floor.
  const runnerUps: Selection["runnerUps"] = [];
  const ru = new Set<string>();
  for (const d of domainNames) {
    sorted
      .filter((c) => !chosen.has(c.paper_id) && home.get(c.paper_id) === d)
      .slice(0, p.runnerUpsPerDomain)
      .forEach((c) => ru.add(c.paper_id));
  }
  for (const c of sorted) if (!chosen.has(c.paper_id) && c.uncertain && c.final_score >= p.floor) ru.add(c.paper_id);
  for (const d of [...domainNames, ...new Set(home.values())]) {
    let r = 0;
    for (const c of sorted) {
      if (ru.has(c.paper_id) && home.get(c.paper_id) === d && !runnerUps.some((x) => x.paper_id === c.paper_id)) {
        runnerUps.push({ paper_id: c.paper_id, domain: d, rank: ++r });
      }
    }
  }

  // S3 quiet-week notice: no paper in the domain at or above the floor.
  const quiet = domainNames
    .filter((d) => !featured.some((f) => f.domain === d) && !sorted.some((c) => home.get(c.paper_id) === d && c.final_score >= p.floor))
    .map((d) => ({ domain: d, scanned: scannedByDomain[d] ?? 0 }));

  return { featured, runnerUps, quiet };
}

export function quietNotice(domain: string, scanned: number) {
  return `${domain}: ${scanned} papers scanned, nothing above the bar this week.`;
}
