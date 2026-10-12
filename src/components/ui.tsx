export function StatCard({
  label,
  value,
  hint,
  hero,
  icon,
  index = 0,
}: {
  label: string;
  value: string;
  hint?: string;
  hero?: boolean;
  icon?: React.ReactNode;
  /** Position in the row; staggers the entrance by 100 ms per card. */
  index?: number;
}) {
  return (
    <div
      className={`card lift rise-in relative ${hero ? "card-hero" : "card-stat"}`}
      style={{ "--delay": `${index * 100}ms` } as React.CSSProperties}
    >
      {icon && (
        <span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-[#a78bfa]" aria-hidden>
          {icon}
        </span>
      )}
      <p className="text-gradient figures text-[32px] font-bold leading-tight tracking-tight">{value}</p>
      <p className="mt-1.5 text-sm text-muted">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  ready: "text-good",
  failed: "text-danger",
};

export function StatusText({ status }: { status: string }) {
  const label = status === "ready" ? "Ready" : status === "failed" ? "Failed" : "In progress";
  return <span className={`shrink-0 text-xs ${STATUS_STYLE[status] ?? "text-muted"}`}>{label}</span>;
}

export const VERDICT_STYLE: Record<string, { color: string; label: string }> = {
  "READ IN FULL": { color: "var(--green)", label: "Read in full" },
  "FLAG FOR A CLIENT": { color: "var(--violet)", label: "Flag for a client" },
  "KNOW IT EXISTS": { color: "var(--amber)", label: "Know it exists" },
};

export function fmtDate(d: string | Date | null | undefined, withTime = false) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-gradient text-2xl font-semibold">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
