"use client";

import { useState } from "react";
import type { Topic } from "@/lib/types";

const split = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function TopicRow({ topic, onSaved, onDeleted }: { topic: Topic; onSaved: (t: Topic) => void; onDeleted: () => void }) {
  const [name, setName] = useState(topic.name);
  const [keywords, setKeywords] = useState(topic.keywords.join(", "));
  const [cats, setCats] = useState(topic.arxiv_categories.join(", "));
  const [active, setActive] = useState(topic.active);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, keywords: split(keywords), arxiv_categories: split(cats), active }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error || "Not saved. Try again." });
    onSaved(json.topic);
    setMsg({ ok: true, text: "Saved" });
  }

  async function remove() {
    if (!confirm(`Remove "${topic.name}"? Past briefs keep their copy of it.`)) return;
    const res = await fetch(`/api/topics/${topic.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
    else setMsg({ ok: false, text: "Not removed. Try again." });
  }

  const id = topic.id;
  return (
    <li className="card">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`n-${id}`} className="text-sm font-medium">
            Domain name
          </label>
          <input id={`n-${id}`} className="input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`c-${id}`} className="text-sm font-medium">
            arXiv categories <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id={`c-${id}`}
            className="input mt-1.5"
            value={cats}
            onChange={(e) => setCats(e.target.value)}
            placeholder="cs.CL, cs.AI"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor={`k-${id}`} className="text-sm font-medium">
            Keywords
          </label>
          <input
            id={`k-${id}`}
            className="input mt-1.5"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Comma-separated"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Include in briefs
        </label>
        <div className="ml-auto flex items-center gap-2">
          {msg && (
            <span role="status" className={`text-xs ${msg.ok ? "text-good" : "text-danger"}`}>
              {msg.text}
            </span>
          )}
          <button type="button" className="btn" onClick={remove}>
            Remove
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </li>
  );
}

export function TopicsEditor({ initial }: { initial: Topic[] }) {
  const [topics, setTopics] = useState(initial);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [cats, setCats] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, keywords: split(keywords), arxiv_categories: split(cats) }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Not added. Try again.");
    setTopics((t) => [...t, json.topic]);
    setName("");
    setKeywords("");
    setCats("");
  }

  return (
    <div className="space-y-6">
      {topics.length === 0 ? (
        <p className="card text-sm text-muted">No domains yet. Add the first one below.</p>
      ) : (
        <ul className="space-y-4">
          {topics.map((t) => (
            <TopicRow
              key={t.id}
              topic={t}
              onSaved={(nt) => setTopics((all) => all.map((x) => (x.id === nt.id ? nt : x)))}
              onDeleted={() => setTopics((all) => all.filter((x) => x.id !== t.id))}
            />
          ))}
        </ul>
      )}

      <form onSubmit={add} className="card" aria-labelledby="add-title">
        <h2 id="add-title" className="text-lg font-semibold">
          Add a domain
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="new-name" className="text-sm font-medium">
              Domain name
            </label>
            <input id="new-name" className="input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="new-cats" className="text-sm font-medium">
              arXiv categories <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="new-cats" className="input mt-1.5" value={cats} onChange={(e) => setCats(e.target.value)} placeholder="cs.CV" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="new-kw" className="text-sm font-medium">
              Keywords
            </label>
            <input
              id="new-kw"
              className="input mt-1.5"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Comma-separated"
              required
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary mt-4">
          Add domain
        </button>
      </form>
    </div>
  );
}
