/**
 * Gemini Flash via the OpenRouter gateway. Only "google/" models, served only by Google's own
 * infrastructure (Vertex or AI Studio), with no fallback to other vendors.
 */
const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

export function geminiModel(): string {
  const m = process.env.GEMINI_MODEL || "google/gemini-3.7-flash";
  if (!m.startsWith("google/")) throw new Error(`GEMINI_MODEL must be a google/ model, got "${m}".`);
  return m;
}

export type UrlCitation = { url: string; title?: string; content?: string; start_index?: number; end_index?: number };

type ChatResult = { content: string; citations: UrlCitation[]; model: string; cost?: number };

type ChatOptions = {
  system?: string;
  user: string;
  schema?: { name: string; schema: Record<string, unknown> };
  webSearch?: boolean;
  temperature?: number;
  /** Reasoning effort; scoring and writing are rubric-following tasks and run fastest at "low". */
  reasoning?: "minimal" | "low" | "medium" | "high";
  /** Overall deadline including retries, so a call always ends inside a short function limit. */
  timeoutMs?: number;
};

export class GeminiError extends Error {
  constructor(message: string, public status?: number, public timedOut = false) {
    super(message);
  }
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new GeminiError("OPENROUTER_API_KEY is not set.");

  const body: Record<string, unknown> = {
    model: geminiModel(),
    messages: [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      { role: "user", content: opts.user },
    ],
    temperature: opts.temperature ?? 0.2,
    provider: { only: ["google-vertex", "google-ai-studio"], allow_fallbacks: false },
    usage: { include: true },
  };
  if (opts.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.schema.name, strict: true, schema: opts.schema.schema },
    };
  }
  if (opts.reasoning) {
    body.reasoning = { effort: opts.reasoning, exclude: true };
  }
  if (opts.webSearch) {
    body.plugins = [{ id: "web", engine: "native" }];
  }

  const timeoutMs = opts.timeoutMs ?? 50_000;
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const wait = 1000 * 2 ** attempt;
      if (Date.now() + wait + 5000 > deadline) break;
      await new Promise((r) => setTimeout(r, wait));
    }
    let res: Response;
    try {
      res = await fetch(BASE_URL, {
        signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "X-Title": "Research Pulse",
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") {
        throw new GeminiError(`Gemini did not answer within ${Math.round(timeoutMs / 1000)} seconds.`, undefined, true);
      }
      throw e;
    }
    if (res.status === 402) throw new GeminiError("OpenRouter is out of credits (402). Top up, then retry this step.", 402);
    if (res.status === 429 || res.status >= 500) {
      lastErr = new GeminiError(`OpenRouter returned ${res.status}.`, res.status);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new GeminiError(`OpenRouter returned ${res.status}: ${text.slice(0, 300)}`, res.status);
    }
    const json = await res.json();
    if (json.error) throw new GeminiError(`OpenRouter error: ${json.error.message ?? JSON.stringify(json.error)}`);
    const msg = json.choices?.[0]?.message ?? {};
    const citations: UrlCitation[] = (msg.annotations ?? [])
      .filter((a: { type?: string }) => a.type === "url_citation")
      .map((a: { url_citation?: UrlCitation }) => a.url_citation)
      .filter((c: UrlCitation | undefined): c is UrlCitation => !!c && typeof c.url === "string");
    return { content: msg.content ?? "", citations, model: json.model, cost: json.usage?.cost };
  }
  throw lastErr instanceof Error ? lastErr : new GeminiError("OpenRouter request failed after retries.");
}

export async function chatJson<T>(opts: ChatOptions & { schema: NonNullable<ChatOptions["schema"]> }): Promise<T> {
  const r = await chat(opts);
  const text = r.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError("Gemini returned output that is not valid JSON.");
  }
}
