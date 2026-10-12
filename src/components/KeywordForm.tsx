"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Topic } from "@/lib/types";
import { EmptySearchArt } from "./icons";

export function KeywordForm({ topics }: { topics: Topic[] }) {
  const router = useRouter();
  const [values, setValues] = useState(() => Object.fromEntries(topics.map((t) => [t.id, t.keywords.join(", ")])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!topics.length) {
    return (
      <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-line px-4 py-8 text-center">
        <EmptySearchArt />
        <p className="mt-4 text-sm font-medium">No domains to search yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted">Add the research areas you follow, with a few keywords each, and they will appear here every week.</p>
        <Link href="/topics" className="btn btn-gradient mt-4">
          Add a domain
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: topics.map((t) => ({ id: t.id, keywords: (values[t.id] ?? "").split(",").map((k) => k.trim()) })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "The run could not start.");
      router.push(`/runs/${json.runId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {topics.map((t) => (
          <div key={t.id}>
            <label htmlFor={`kw-${t.id}`} className="text-sm font-medium">
              {t.name}
            </label>
            <input
              id={`kw-${t.id}`}
              className="input mt-1.5"
              value={values[t.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [t.id]: e.target.value }))}
              placeholder="Comma-separated keywords"
            />
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Starting…" : "Run this week's brief"}
        </button>
        <p className="text-xs text-muted">Takes a few minutes. Keep the run page open while it works.</p>
      </div>
    </form>
  );
}
