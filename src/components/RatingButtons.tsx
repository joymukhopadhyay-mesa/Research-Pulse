"use client";

import { useState } from "react";
import { IconThumbDown, IconThumbUp } from "./icons";

export function RatingButtons({ itemId, initial }: { itemId: string; initial: boolean | null }) {
  const [value, setValue] = useState<boolean | null>(initial);
  const [error, setError] = useState(false);

  async function rate(useful: boolean) {
    const prev = value;
    setValue(useful);
    setError(false);
    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ briefItemId: itemId, useful }),
    }).catch(() => null);
    if (!res?.ok) {
      setValue(prev);
      setError(true);
    }
  }

  const cls = (on: boolean) => `btn px-3 py-1.5 text-xs ${on ? "border-accent-2 bg-accent/25" : ""}`;
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Rate this card">
      <button type="button" className={cls(value === true)} aria-pressed={value === true} onClick={() => rate(true)}>
        <IconThumbUp className="h-4 w-4" /> Useful
      </button>
      <button type="button" className={cls(value === false)} aria-pressed={value === false} onClick={() => rate(false)}>
        <IconThumbDown className="h-4 w-4" /> Not useful
      </button>
      {error && <span className="text-xs text-danger">Rating not saved. Try again.</span>}
    </div>
  );
}
