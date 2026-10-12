// Categorical order validated against the --surface card colour (dark, 8 slots). Fixed order, never cycled.
const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const OTHER = "#5c5c78";

export function ProfileCard() {
  return (
    <section className="card" aria-label="Profile">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-accent/25 text-sm font-semibold text-text" aria-hidden>
          K
        </div>
        <div>
          <p className="text-sm font-medium">Kavita</p>
          <p className="text-xs text-muted">Senior consultant, technology advisory</p>
        </div>
      </div>
      <ul className="mt-4 space-y-1 text-xs text-muted">
        <li>Q1. Which architectures should we bet on?</li>
        <li>Q2. Which use cases have real research backing?</li>
        <li>Q3. Which direction is the field moving?</li>
      </ul>
    </section>
  );
}

type Slice = { label: string; value: number };

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos(a - Math.PI / 2), cy + r * Math.sin(a - Math.PI / 2)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

export function CoverageDonut({ data, title = "Coverage by domain" }: { data: Slice[]; title?: string }) {
  let slices = data.filter((d) => d.value > 0);
  if (slices.length > SERIES.length) {
    const head = slices.slice(0, SERIES.length - 1);
    const rest = slices.slice(SERIES.length - 1).reduce((n, s) => n + s.value, 0);
    slices = [...head, { label: "Other", value: rest }];
  }
  const total = slices.reduce((n, s) => n + s.value, 0);
  const colour = (i: number, label: string) => (label === "Other" ? OTHER : SERIES[i]);
  const gap = slices.length > 1 ? 0.04 : 0;
  let a = 0;

  return (
    <section className="card" aria-label={title}>
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-xs text-muted">Papers scanned in the latest brief</p>
      {total === 0 ? (
        <p className="mt-4 text-sm text-muted">No coverage yet. Run a brief to see it here.</p>
      ) : (
        <>
          <svg viewBox="0 0 120 120" className="mx-auto mt-4 block h-36 w-36" role="img" aria-label={`${total} papers scanned`}>
            {slices.map((s, i) => {
              const a0 = a;
              const a1 = a + (s.value / total) * Math.PI * 2;
              a = a1;
              if (slices.length === 1) {
                return <circle key={s.label} cx="60" cy="60" r="46" fill="none" stroke={colour(i, s.label)} strokeWidth="14" />;
              }
              return (
                <path key={s.label} d={arc(60, 60, 46, a0 + gap / 2, a1 - gap / 2)} fill="none" stroke={colour(i, s.label)} strokeWidth="14">
                  <title>{`${s.label}: ${s.value}`}</title>
                </path>
              );
            })}
            <text x="60" y="58" textAnchor="middle" className="fill-[var(--text)]" fontSize="20" fontWeight="300">
              {total}
            </text>
            <text x="60" y="74" textAnchor="middle" className="fill-[var(--muted)]" fontSize="9">
              scanned
            </text>
          </svg>
          <ul className="mt-4 space-y-1.5">
            {slices.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colour(i, s.label) }} aria-hidden />
                <span className="flex-1 truncate text-muted" title={s.label}>
                  {s.label}
                </span>
                <span className="tabular-nums text-text">{s.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function ScoreBars({ data }: { data: { label: string; value: number; href?: string }[] }) {
  return (
    <section className="card" aria-label="Top scores">
      <h2 className="text-sm font-medium">Top scores</h2>
      <p className="text-xs text-muted">Featured papers, out of 10</p>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Scores appear after the first brief.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.map((d, i) => (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-muted" title={d.label}>
                  {d.label}
                </span>
                <span className="tabular-nums text-text">{d.value.toFixed(1)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/5" aria-hidden>
                <div className="h-1.5 rounded-full bg-accent-2" style={{ width: `${Math.max(2, d.value * 10)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
