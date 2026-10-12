// One short text call through OpenRouter to confirm the key, model and Google-only routing.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: process.env.GEMINI_MODEL || "google/gemini-3.7-flash",
    messages: [{ role: "user", content: "Hello, who are you?" }],
    provider: { only: ["google-vertex", "google-ai-studio"], allow_fallbacks: false },
    usage: { include: true },
  }),
});
const json = await res.json();
if (!res.ok) { console.log("HTTP", res.status, JSON.stringify(json.error ?? json).slice(0, 300)); process.exit(1); }
console.log("model:", json.model, "| provider:", json.provider);
console.log("reply:", json.choices?.[0]?.message?.content);
console.log("usage:", JSON.stringify({ prompt: json.usage?.prompt_tokens, completion: json.usage?.completion_tokens, cost: json.usage?.cost }));
