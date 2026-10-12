import path from "path";
import { Document, Font, Link, Page, Path, StyleSheet, Svg, Circle, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Brief, Card } from "./brief";
import { SOURCE_LABEL } from "./types";

/* ------------------------------------------------------------------ */
/* Print design: navy bands, white pages, pink accents, orange heads.  */
/* ------------------------------------------------------------------ */

const C = {
  navy: "#14284b",
  pink: "#d81b60", // white text on it stays above 4.5:1
  pinkLine: "#f2b3c6",
  pinkTint: "#fde7ef",
  orange: "#c8640a", // bold 12pt+ headings: above the 3:1 large-text floor
  text: "#4b4b5c",
  muted: "#6e6e80",
  bubble: "#eef0f5",
  white: "#ffffff",
};

const FONT_DIR = path.join(process.cwd(), "node_modules", "@fontsource", "poppins", "files");
Font.register({
  family: "Poppins",
  fonts: [400, 500, 600, 700].map((w) => ({ src: path.join(FONT_DIR, `poppins-latin-${w}-normal.woff`), fontWeight: w })),
});
// Long paper titles wrap on spaces, not mid-word.
Font.registerHyphenationCallback((word) => [word]);

/** Poppins (latin) has no glyphs for some symbols models like to use; swap them for safe equivalents. */
function clean(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/→|⇒/g, "->")
    .replace(/←/g, "<-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≈|∼/g, "~")
    .replace(/±/g, "+/-")
    .replace(/∞/g, "infinity")
    .replace(/[α]/g, "alpha")
    .replace(/[β]/g, "beta")
    .replace(/[γ]/g, "gamma")
    .replace(/[δΔ]/g, "delta")
    .replace(/[λ]/g, "lambda")
    .replace(/[μ]/g, "mu")
    .replace(/[σ]/g, "sigma")
    .replace(/[θ]/g, "theta")
    .replace(/[π]/g, "pi");
}

const s = StyleSheet.create({
  page: { fontFamily: "Poppins", fontSize: 9, color: C.text, paddingTop: 96, paddingBottom: 78, paddingHorizontal: 44, lineHeight: 1.45 },

  band: { position: "absolute", left: 0, right: 0, backgroundColor: C.navy, paddingHorizontal: 44 },
  header: { top: 0, height: 66, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: C.white, fontSize: 17, fontWeight: 700, letterSpacing: 0.6, lineHeight: 1.25 },
  headerSub: { color: "#c9d1e4", fontSize: 7.5, lineHeight: 1.3, marginTop: 2 },
  footer: { bottom: 0, height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerStrong: { color: C.white, fontSize: 8.5, fontWeight: 600 },
  footerSoft: { color: "#c9d1e4", fontSize: 7 },

  h1: { fontSize: 26, fontWeight: 700, color: C.navy, lineHeight: 1.15 },
  h2: { fontSize: 20, fontWeight: 700, color: C.navy, lineHeight: 1.2 },
  intro: { fontSize: 9.5, color: C.muted, marginTop: 6, marginBottom: 18, maxWidth: 440 },

  grid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: C.pinkLine },
  cell: { width: "50%", borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: C.pinkLine, padding: 14, minHeight: 112 },
  capRow: { flexDirection: "row", alignItems: "flex-start" },
  cap: { fontSize: 38, fontWeight: 700, color: C.navy, lineHeight: 1 },
  capRest: { fontSize: 12.5, fontWeight: 700, color: C.navy, marginTop: 5, marginLeft: 1, flex: 1, lineHeight: 1.2 },
  cellText: { fontSize: 7.5, color: C.muted, marginTop: 6, marginLeft: 26 },
  bullet: { fontSize: 8.5, color: C.text, marginTop: 3, marginLeft: 26 },

  callout: { backgroundColor: C.pink, borderRadius: 14, padding: 18 },
  calloutText: { color: C.white, fontSize: 10.5, lineHeight: 1.5, textAlign: "center" },

  banner: { backgroundColor: C.pink, borderRadius: 3, paddingVertical: 4, alignItems: "center" },
  bannerText: { color: C.white, fontSize: 9, fontWeight: 600 },
  boxes: { flexDirection: "row", marginTop: 5 },
  box: { flex: 1, borderWidth: 0.75, borderColor: C.pinkLine, borderRadius: 2, paddingVertical: 4, marginHorizontal: 2, alignItems: "center" },
  boxLabel: { fontSize: 6.5, color: C.muted },
  boxValue: { fontSize: 10, fontWeight: 700, color: C.navy },

  paper: { paddingVertical: 12, borderBottomWidth: 0.75, borderColor: C.pinkLine },
  scoreRow: { flexDirection: "row", marginBottom: 4 },
  scoreBox: { borderRadius: 3, paddingVertical: 4, paddingHorizontal: 6, marginRight: 4, justifyContent: "center" },
  fields: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  fieldCell: { width: "50%", paddingHorizontal: 6 },
  linkCols: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  linkCell: { width: "50%", paddingHorizontal: 6 },
  paperTitle: { fontSize: 12.5, fontWeight: 600, color: C.orange, textDecoration: "none", lineHeight: 1.3 },
  meta: { fontSize: 7, color: C.muted, marginTop: 2, marginBottom: 7 },
  label: { fontSize: 7.8, fontWeight: 600, color: C.navy, marginTop: 5 },
  field: { fontSize: 8.6, color: C.text, lineHeight: 1.4 },

  notice: { borderLeftWidth: 3, borderColor: C.pink, paddingLeft: 10, paddingVertical: 4, color: C.muted, fontSize: 9, marginBottom: 6 },

  newsItem: { paddingVertical: 10, borderBottomWidth: 0.75, borderColor: C.pinkLine },
  newsHead: { fontSize: 11, fontWeight: 600, color: C.orange, textDecoration: "none" },

  th: { flexDirection: "row", backgroundColor: C.navy, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 2 },
  thText: { color: C.white, fontSize: 8, fontWeight: 600 },
  tr: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.75, borderColor: C.pinkLine },
  td: { fontSize: 8.5 },
  linkSmall: { fontSize: 7.2, color: C.navy, textDecoration: "none", marginTop: 2 },
});

const VERDICT: Record<string, { label: string; bg: string; fg: string; soft: string }> = {
  "READ IN FULL": { label: "Read in full", bg: C.pink, fg: C.white, soft: "#ffe3ee" },
  "FLAG FOR A CLIENT": { label: "Flag for a client", bg: C.navy, fg: C.white, soft: "#d5dcee" },
  "KNOW IT EXISTS": { label: "Know it exists", bg: C.pinkTint, fg: C.navy, soft: C.muted },
};

/** Soft grey circles scattered behind the content, the same on every page. */
function Bubbles() {
  const dots: [number, number, number][] = [
    [520, 120, 34], [470, 210, 14], [560, 300, 22], [40, 330, 18], [90, 420, 9], [515, 470, 30],
    [30, 560, 26], [560, 610, 12], [480, 690, 24], [70, 720, 14], [300, 150, 8], [250, 640, 10],
    [380, 760, 16], [150, 250, 11], [420, 380, 7],
  ];
  return (
    <Svg fixed style={{ position: "absolute", top: 0, left: 0, width: 595, height: 842 }} viewBox="0 0 595 842">
      {dots.map(([cx, cy, r], i) => (
        <Circle key={i} cx={cx} cy={cy} r={r} fill={C.bubble} />
      ))}
    </Svg>
  );
}

function Chrome({ date, minutes, site }: { date: string; minutes: number | null; site: string }) {
  return (
    <>
      <Bubbles />
      <View fixed style={[s.band, s.header]}>
        <View>
          <Text style={s.headerTitle}>RESEARCH PULSE</Text>
          <Text style={s.headerSub}>Weekly AI and ML research brief · Week of {date}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Svg width={34} height={16} viewBox="0 0 34 16">
            <Path d="M1 8h7l3-6 6 12 3-6h13" stroke={C.pink} strokeWidth={2} fill="none" />
          </Svg>
          <Text style={{ color: C.white, fontSize: 8.5, fontWeight: 600, marginLeft: 8 }}>{minutes ?? "?"} min read</Text>
        </View>
      </View>
      <View fixed style={[s.band, s.footer]}>
        <Text style={s.footerStrong}>{site}</Text>
        <Text style={s.footerSoft}>arXiv · Semantic Scholar · Google Scholar · Google News</Text>
        <View style={{ width: 90 }} />
      </View>
      {/* Page numbers sit directly on the page: react-pdf skips dynamic text nested in a fixed band. */}
      <Text
        fixed
        style={[s.footerStrong, { position: "absolute", top: 812, left: 461, width: 90, textAlign: "right" }]}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </>
  );
}

/** "AI agents" -> big "A" + "I agents", in the drop-cap style of the print reference. */
function DropCap({ name }: { name: string }) {
  return (
    <View style={s.capRow}>
      <Text style={s.cap}>{name.charAt(0)}</Text>
      <Text style={s.capRest}>{name.slice(1)}</Text>
    </View>
  );
}

/** Score, the four rubric dimensions and the verdict as one row of boxes: the banner-and-boxes motif of the print reference. */
function ScoreRow({ c }: { c: Card }) {
  const v = VERDICT[c.verdict ?? ""] ?? VERDICT["KNOW IT EXISTS"];
  const dims: [string, number][] = [
    ["Shift", c.shift],
    ["Relevance", c.client_relevance],
    ["Evidence", c.evidence],
    ["Maturity", c.maturity],
  ];
  return (
    <View style={s.scoreRow}>
      <View style={[s.scoreBox, { backgroundColor: C.pink, width: 62 }]}>
        <Text style={{ color: C.white, fontSize: 12, fontWeight: 700, lineHeight: 1.1 }}>{c.final_score.toFixed(1)}</Text>
        <Text style={{ color: "#ffd3e2", fontSize: 6.3 }}>score / 10</Text>
      </View>
      {dims.map(([k, val]) => (
        <View key={k} style={[s.scoreBox, { borderWidth: 0.75, borderColor: C.pinkLine, width: 58, alignItems: "center" }]}>
          <Text style={{ color: C.navy, fontSize: 10, fontWeight: 700, lineHeight: 1.1 }}>{val}/3</Text>
          <Text style={{ color: C.muted, fontSize: 6.3 }}>{k}</Text>
        </View>
      ))}
      <View style={[s.scoreBox, { backgroundColor: v.bg, flex: 1, marginRight: 0, paddingHorizontal: 10 }]}>
        <Text style={{ color: v.fg === C.white ? "#ffd3e2" : C.muted, fontSize: 6.3, letterSpacing: 0.4 }}>VERDICT</Text>
        <Text style={{ color: v.fg, fontSize: 10.5, fontWeight: 700, lineHeight: 1.15 }}>{v.label}</Text>
      </View>
    </View>
  );
}

function PaperBlock({ c }: { c: Card }) {
  const others = (c.tags ?? []).filter((t) => t !== c.domain);
  const meta = [
    SOURCE_LABEL[c.source],
    c.source === "arxiv" ? "Preprint, not yet peer-reviewed" : null,
    c.published_at ? new Date(c.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null,
    others.length ? `Also tagged: ${others.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const fields: [string, string | null][] = [
    ["What's new", c.whats_new],
    ["Why it matters", c.why_it_matters],
    ["Client angle", c.client_angle],
    ["Evidence", c.evidence_note],
  ];
  return (
    <View style={s.paper} wrap={false}>
      <Link src={c.url} style={s.paperTitle}>
        {clean(c.title)}
      </Link>
      <Text style={s.meta}>{meta}</Text>
      <ScoreRow c={c} />
      <View style={s.fields}>
        {fields.map(([k, val]) => (
          <View key={k} style={s.fieldCell}>
            <Text style={s.label}>{k}</Text>
            <Text style={s.field}>{clean(val)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BriefPdf({ b }: { b: Brief }) {
  const date = new Date(b.run.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const site = (process.env.APP_URL || "research-pulse").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const featured = b.sections.flatMap((x) => x.cards);
  const scanned = b.coverage.reduce((n, x) => n + x.scanned, 0);
  const cov = new Map(b.coverage.map((x) => [x.domain, x]));
  const count = (verdict: string) => featured.filter((c) => c.verdict === verdict).length;
  const domains = b.run.domains ?? [];

  return (
    <Document title={`Research Pulse, week of ${date}`} author="Research Pulse">
      <Page size="A4" style={s.page} wrap>
        <Chrome date={date} minutes={b.run.read_minutes} site={site} />

        {/* Page 1: the week at a glance. */}
        <Text style={s.h1}>This week in research</Text>
        <Text style={s.intro}>
          {featured.length} papers selected from {scanned} scanned across {b.sections.length} domains. Every paper below was
          scored against the rubric; every link comes straight from its source.
        </Text>

        <View style={s.grid}>
          {b.sections.map((sec) => {
            const c = cov.get(sec.domain);
            const kw = domains.find((d) => d.name === sec.domain)?.keywords ?? [];
            return (
              <View key={sec.domain} style={s.cell} wrap={false}>
                <DropCap name={sec.domain} />
                {kw.length > 0 && <Text style={s.cellText}>{clean(kw.join(", "))}</Text>}
                <Text style={s.bullet}>• {sec.cards.length} {sec.cards.length === 1 ? "paper" : "papers"} in this brief</Text>
                <Text style={s.bullet}>• {c?.scanned ?? 0} papers scanned</Text>
                {sec.cards.length === 0 && <Text style={[s.bullet, { color: C.pink }]}>• Quiet week</Text>}
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", marginTop: 22 }} wrap={false}>
          {/* Sideways label with this week's headlines, after the reference's "tactical rollout" column. */}
          <View style={{ width: 22, height: 128, marginRight: 10 }}>
            <View style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 2.5, backgroundColor: C.pink }} />
            <Text
              style={{
                position: "absolute",
                width: 128,
                left: -55,
                top: 54,
                transform: "rotate(-90deg)",
                color: C.pink,
                fontSize: 13,
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              In the news
            </Text>
          </View>
          <View style={{ flex: 1, paddingRight: 14 }}>
            {b.news.length === 0 ? (
              <Text style={{ fontSize: 9, color: C.muted }}>No notable news this week.</Text>
            ) : (
              b.news.slice(0, 5).map((n) => (
                <Text key={n.id} style={{ fontSize: 8.5, color: C.muted, marginBottom: 5 }}>
                  {clean(n.headline)}
                </Text>
              ))
            )}
          </View>
          <View style={[s.callout, { width: 230, alignSelf: "center" }]}>
            <Text style={s.calloutText}>
              <Text style={{ fontWeight: 700 }}>{count("READ IN FULL")} to read in full</Text>, {count("FLAG FOR A CLIENT")} to
              flag for a client and {count("KNOW IT EXISTS")} worth knowing about.{" "}
              <Text style={{ fontWeight: 700 }}>{b.run.read_minutes ?? "?"} minutes</Text> from start to finish.
            </Text>
          </View>
        </View>

        {/* Domain sections. */}
        {b.sections.map((sec, i) => (
          <View key={sec.domain} break={i === 0}>
            {/* The heading travels with its first paper (or notice), so it is never stranded at a page foot. */}
            <View wrap={false} style={{ marginTop: i === 0 ? 0 : 18 }}>
              <Text style={s.h2}>{sec.domain}</Text>
              <Text style={[s.intro, { marginBottom: 8 }]}>
                {sec.cards.length
                  ? `${sec.cards.length} ${sec.cards.length === 1 ? "paper" : "papers"} selected from ${cov.get(sec.domain)?.scanned ?? 0} scanned this week.`
                  : `${cov.get(sec.domain)?.scanned ?? 0} papers scanned this week.`}
              </Text>
              {sec.notice && <Text style={s.notice}>{clean(sec.notice)}</Text>}
              {sec.cards[0] && <PaperBlock c={sec.cards[0]} />}
            </View>
            {sec.cards.slice(1).map((c) => (
              <PaperBlock key={c.item_id} c={c} />
            ))}
          </View>
        ))}

        {/* In the news. */}
        <View break>
          <Text style={s.h2}>In the news</Text>
          <Text style={s.intro}>From Google Search grounding. News is not scored and never changes a paper&apos;s score.</Text>
          {b.news.length === 0 && <Text style={s.notice}>No notable news this week.</Text>}
          {b.news.map((n) => (
            <View key={n.id} style={s.newsItem} wrap={false}>
              <Link src={n.url} style={s.newsHead}>
                {clean(n.headline)}
              </Link>
              <Text style={{ fontSize: 9, marginTop: 2 }}>{clean(n.summary)}</Text>
              {n.related_domain && (
                <Text style={{ fontSize: 8, fontWeight: 600, color: C.pink, marginTop: 3 }}>Covered above in {n.related_domain}.</Text>
              )}
            </View>
          ))}
        </View>

        {/* Appendix. */}
        <View break>
          <Text style={s.h2}>Appendix</Text>
          <Text style={s.intro}>The coverage log, the runner-ups and every link gathered this week. Not counted in the read time.</Text>

          <View style={[s.banner, { marginBottom: 6 }]}>
            <Text style={s.bannerText}>Coverage log</Text>
          </View>
          <View style={s.th}>
            <Text style={[s.thText, { flex: 3 }]}>Domain</Text>
            <Text style={[s.thText, { flex: 1, textAlign: "right" }]}>Scanned</Text>
            <Text style={[s.thText, { flex: 1, textAlign: "right" }]}>Gated out</Text>
            <Text style={[s.thText, { flex: 1, textAlign: "right" }]}>Scored</Text>
            <Text style={[s.thText, { flex: 1, textAlign: "right" }]}>Selected</Text>
          </View>
          {b.coverage.map((c) => (
            <View key={c.domain} style={s.tr}>
              <Text style={[s.td, { flex: 3 }]}>{c.domain}</Text>
              <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{c.scanned}</Text>
              <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{c.gated_out}</Text>
              <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{c.scored}</Text>
              <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{c.selected}</Text>
            </View>
          ))}
          <View style={[s.tr, { borderBottomWidth: 0 }]}>
            <Text style={[s.td, { flex: 3, fontWeight: 700, color: C.navy }]}>Total</Text>
            {(["scanned", "gated_out", "scored", "selected"] as const).map((k) => (
              <Text key={k} style={[s.td, { flex: 1, textAlign: "right", fontWeight: 700, color: C.navy }]}>
                {b.coverage.reduce((n, c) => n + c[k], 0)}
              </Text>
            ))}
          </View>

          {b.runnerUps.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <View style={[s.banner, { marginBottom: 6 }]}>
                <Text style={s.bannerText}>Runner-ups</Text>
              </View>
              {b.runnerUps.map((r) => (
                <Link key={r.item_id} src={r.url} style={[s.linkSmall, { fontSize: 8 }]}>
                  {r.domain}: {clean(r.title)}
                </Link>
              ))}
            </View>
          )}

          <View break>
            <View style={[s.banner, { marginBottom: 6 }]}>
              <Text style={s.bannerText}>Every link gathered ({b.links.reduce((n, g) => n + g.items.length, 0)})</Text>
            </View>
            {b.links.map((g) => (
              <View key={g.source} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 9, fontWeight: 600, color: C.orange, marginBottom: 2 }}>
                  {SOURCE_LABEL[g.source as keyof typeof SOURCE_LABEL] ?? g.source} ({g.items.length})
                </Text>
                <View style={s.linkCols}>
                  {g.items.map((l, i) => (
                    <View key={i} style={s.linkCell}>
                      <Link src={l.url} style={s.linkSmall}>
                        <Text style={{ maxLines: 1, textOverflow: "ellipsis" }}>{clean(l.title)}</Text>
                      </Link>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderBriefPdf(b: Brief): Promise<Buffer> {
  return renderToBuffer(<BriefPdf b={b} />);
}
