"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "./ui";

/**
 * A timestamp in the reader's own time zone. The server renders in UTC (Vercel's zone),
 * so the browser re-formats it after hydration.
 */
export function LocalTime({ value, withTime = false }: { value: string | Date; withTime?: boolean }) {
  const iso = new Date(value).toISOString();
  const [text, setText] = useState(() => fmtDate(iso, withTime));
  useEffect(() => setText(fmtDate(iso, withTime)), [iso, withTime]);
  return (
    <time dateTime={iso} className="figures">
      {text}
    </time>
  );
}
