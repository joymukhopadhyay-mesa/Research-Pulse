import { Document, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Brief } from "./brief";
import { SOURCE_LABEL } from "./types";

const VERDICT_COLOR: Record<string, string> = {
  "READ IN FULL": "#15803D",
  "FLAG FOR A CLIENT": "#7E22CE",
  "KNOW IT EXISTS": "#B45309",
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1A1A2E", lineHeight: 1.4 },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  meta: { fontSize: 10, color: "#55557A", marginBottom: 16 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6, color: "#4C3FC4" },
  card: { borderWidth: 1, borderColor: "#E2E0F5", borderRadius: 6, padding: 10, marginBottom: 8 },
  title: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1A1A2E", textDecoration: "none" },
  small: { fontSize: 8.5, color: "#55557A", marginTop: 2, marginBottom: 4 },
  label: { fontFamily: "Helvetica-Bold" },
  verdict: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 4 },
  notice: { color: "#55557A", fontStyle: "italic", marginBottom: 4 },
  link: { color: "#4C3FC4", fontSize: 8.5 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E2E0F5", paddingVertical: 2 },
  cell: { flex: 1, fontSize: 8.5 },
  cellWide: { flex: 3, fontSize: 8.5 },
});

function BriefPdf({ b }: { b: Brief }) {
  const date = new Date(b.run.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <Document title={`Research Pulse, ${date}`}>
      <Page size="A4" style={s.page} wrap>
        <Text style={s.h1}>Research Pulse</Text>
        <Text style={s.meta}>
          Week of {date} · {b.run.read_minutes ?? "?"} min read · {b.run.word_count ?? 0} words
        </Text>

        {b.sections.map((sec) => (
          <View key={sec.domain}>
            <Text style={s.h2}>{sec.domain}</Text>
            {sec.notice && <Text style={s.notice}>{sec.notice}</Text>}
            {sec.cards.map((c) => (
              <View key={c.item_id} style={s.card} wrap={false}>
                <Link src={c.url} style={s.title}>
                  {c.title}
                </Link>
                <Text style={s.small}>
                  {SOURCE_LABEL[c.source]} · score {c.final_score.toFixed(1)}
                  {c.tags?.length > 1 ? ` · also tagged ${c.tags.filter((t) => t !== c.domain).join(", ")}` : ""}
                </Text>
                <Text>
                  <Text style={s.label}>What&apos;s new: </Text>
                  {c.whats_new}
                </Text>
                <Text>
                  <Text style={s.label}>Why it matters: </Text>
                  {c.why_it_matters}
                </Text>
                <Text>
                  <Text style={s.label}>Client angle: </Text>
                  {c.client_angle}
                </Text>
                <Text>
                  <Text style={s.label}>Evidence: </Text>
                  {c.evidence_note}
                </Text>
                <Text style={[s.verdict, { color: VERDICT_COLOR[c.verdict ?? ""] ?? "#1A1A2E" }]}>{c.verdict}</Text>
                <Link src={c.url} style={s.link}>
                  {c.url}
                </Link>
              </View>
            ))}
          </View>
        ))}

        <Text style={s.h2}>In the news</Text>
        {b.news.length === 0 && <Text style={s.notice}>No notable news this week.</Text>}
        {b.news.map((n) => (
          <View key={n.id} style={{ marginBottom: 6 }}>
            <Link src={n.url} style={s.title}>
              {n.headline}
            </Link>
            <Text>
              {n.summary}
              {n.related_domain ? ` Covered above in ${n.related_domain}.` : ""}
            </Text>
          </View>
        ))}

        <Text style={s.h2} break>
          Appendix: coverage log
        </Text>
        <View style={[s.row, { borderBottomWidth: 1 }]}>
          <Text style={[s.cellWide, s.label]}>Domain</Text>
          <Text style={[s.cell, s.label]}>Scanned</Text>
          <Text style={[s.cell, s.label]}>Gated out</Text>
          <Text style={[s.cell, s.label]}>Scored</Text>
          <Text style={[s.cell, s.label]}>Selected</Text>
        </View>
        {b.coverage.map((c) => (
          <View key={c.domain} style={s.row}>
            <Text style={s.cellWide}>{c.domain}</Text>
            <Text style={s.cell}>{c.scanned}</Text>
            <Text style={s.cell}>{c.gated_out}</Text>
            <Text style={s.cell}>{c.scored}</Text>
            <Text style={s.cell}>{c.selected}</Text>
          </View>
        ))}

        {b.runnerUps.length > 0 && (
          <>
            <Text style={s.h2}>Runner-ups</Text>
            {b.runnerUps.map((r) => (
              <Link key={r.item_id} src={r.url} style={s.link}>
                {r.domain}: {r.title}
              </Link>
            ))}
          </>
        )}

        <Text style={s.h2}>All links gathered</Text>
        {b.links.map((g) => (
          <View key={g.source} style={{ marginBottom: 6 }}>
            <Text style={s.label}>
              {SOURCE_LABEL[g.source as keyof typeof SOURCE_LABEL] ?? g.source} ({g.items.length})
            </Text>
            {g.items.map((l, i) => (
              <Link key={i} src={l.url} style={s.link}>
                {l.title}
              </Link>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function renderBriefPdf(b: Brief): Promise<Buffer> {
  return renderToBuffer(<BriefPdf b={b} />);
}
