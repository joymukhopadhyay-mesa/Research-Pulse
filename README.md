# Research Pulse

A weekly AI and ML research brief for Kavita, a senior consultant in a technology advisory practice. She types this week's keywords and clicks **Run this week's brief**. The app pulls papers from four live sources and uses Gemini Flash to score and summarise them. She gets a brief she can read in under ten minutes, on screen and as a PDF in her inbox.

Nothing runs on a schedule. There is no cron job; a brief is built only when Kavita clicks Run.

- **Live app:** https://research-pulse-nine.vercel.app
- **Code:** https://github.com/joymukhopadhyay-mesa/Research-Pulse

## How it works

```
Kavita enters keywords
        │
        ├──> arXiv API ─────────┐
        ├──> Google Scholar ────┼──> merge & dedupe ──> Gemini: score ──> select ──┐
        ├──> Semantic Scholar ──┘                                                   │
        └──> Google News ───────────────────────────────────────────────────────────┤
                                                                                    ▼
                                                                          Gemini: write cards
                                                                                    │
                        ┌───────────────┬──────────────┬────────────────────────────┘
                        ▼               ▼              ▼              ▼
                   Web brief          PDF         Resend email     Neon archive
                                                                        │
                                                       Kavita rates ────┘ (feeds rubric tuning)
```

The pipeline is a job split into short requests, so each one fits within the Vercel Hobby function limit. The run page drives the steps and shows live progress.

| Step | Endpoint | What it does |
|---|---|---|
| 1 | `POST /api/runs` | Saves the keywords to `topics` and creates a run that snapshots the domains |
| 2 | `POST /api/runs/[id]/fetch` | Handles one source for one domain per call. Scholar is started, then polled, and dropped after 90 s |
| 3 | `POST /api/runs/[id]/score` | Scores one batch of 10 papers per call. The client runs 3 in parallel, using row locks |
| 4 | `POST /api/runs/[id]/select` | Applies rules S1–S9, then writes `brief_items` and `coverage` |
| 5 | `POST /api/runs/[id]/write` | Validates arXiv IDs, writes the cards 4 per call, runs the news call, then enforces the word budget |
| 6 | `POST /api/runs/[id]/deliver` | Renders the PDF and emails it with Resend |
| 7 | `GET /api/runs/[id]` | Returns status, progress and counts |

Every step is idempotent. A finished source and domain pair returns its stored result, and score inserts use `on conflict do nothing`. Selection rewrites its own rows, and delivery skips if the email has already gone. When a step fails, its error is written to the run row and the run page offers **Retry**.

## Component map

| Component | Where | Notes |
|---|---|---|
| Rubric | `prompts/Research_rubric.txt` | The only place scoring criteria live. It is read with `fs.readFileSync` on every run. Weights, bar, floor, caps and word budget are parsed from its text, so editing it changes the next brief |
| Rubric loader | `src/lib/rubric.ts` | Parses parameters, computes `final_score` in code, and slices sections into prompts |
| Prompts | `src/lib/prompts.ts` | Scaffolding plus the rubric text verbatim, with a JSON schema for each Gemini call |
| Gemini client | `src/lib/gemini.ts` | Calls OpenRouter with `google/` models only and the provider pinned to `google-vertex` / `google-ai-studio`. No fallbacks; retries 429 and 5xx with backoff |
| arXiv | `src/lib/sources/arxiv.ts` | Atom XML parsed with `fast-xml-parser`, 3 s between calls, ID validation against a real `id_list` lookup |
| Semantic Scholar | `src/lib/sources/semanticScholar.ts` | Relevance search per keyword, limited to the last 7 days. Serves as the safety net |
| Google Scholar | `src/lib/sources/scholar.ts` | Apify actor `marco.gullo~google-scholar-scraper`, run asynchronously with a 90 s timeout |
| Google News | `src/lib/pipeline/write.ts` | One Gemini call with native web search grounding. URLs come only from the citations |
| Merge and dedupe | `src/lib/papers.ts` | Matches on arXiv ID, then DOI, then normalised title. Duplicates are kept as "also found on" links |
| Selection | `src/lib/selection.ts` | Rules S1–S8 as a pure function |
| Brief loader | `src/lib/brief.ts` | Shared by the web brief, the PDF and the word count |
| PDF | `src/lib/pdf.tsx` | Built with `@react-pdf/renderer` |
| Email | `src/lib/pipeline/deliver.ts` | Sent with Resend, with the PDF attached |
| Database | `db/schema.sql`, `src/lib/db.ts` | Neon Postgres via `@neondatabase/serverless` |
| UI | `src/app/*`, `src/components/*` | Overview, Run, Brief, Briefs archive, Topics, Settings, About |

## The rubric in code

- **Gemini returns only the four 0–3 dimension scores**, plus proof quotes, domain tags, client questions, the uncertainty flag and the gate result. It uses structured output in the rubric's JSON shape.
- **The code computes the score**: `round((shift×3 + relevance×2 + evidence×2 + maturity×1) / 24 × 10, 1)`. The weights are read from the rubric file.
- **R1 is enforced in code.** A 2 or 3 that comes back without a proof quote is lowered to 1.
- **G3 (new this week, not in an earlier brief) is checked by code** at fetch time.
- **Selection (S1–S9) is done by code**: the 7.0 bar, the 5.0 domain floor, quiet-week notices, caps of 3 per domain and 12 in total, the must-see override, tie-breaks, runner-ups, one appearance per paper, and the coverage log.
- **Read time** is `ceil(words / 200)`. Above 2,000 words, the lowest-scored paper that isn't a must-see moves to the runner-ups and the count is redone. The appendix doesn't count toward the limit.

### Assumptions

- **Must-see papers (S5)** are picked first. They bypass both the 7.0 bar and the per-domain cap, and they don't use up a cap slot. They still count toward the total of 12.
- **S8 home domain.** Gemini returns Kavita's domains ordered from most to least client-relevant. A paper sits under the first of those that she monitors.
- **Google Scholar dates.** With date sorting, Scholar prefixes each snippet with its age ("2 days ago"), which becomes an exact date for the 7-day rule. Items without that prefix carry only a year, so items from this year and last year are kept.
- **Links.** Every link comes from an API response. Gemini never writes a URL. Every arXiv ID is confirmed against a live arXiv lookup before it reaches the page, and every arXiv card carries "Preprint, not yet peer-reviewed".

## Setup

1. **Install**
   ```bash
   npm install
   ```
2. **Database.** Create a Neon project and run `db/schema.sql` in its SQL editor. The script also seeds six starting domains, which you can edit on the Topics page.
3. **Environment.** Copy `.env.example` to `.env.local` and fill it in.
   - **Google Scholar:** the Apify actor needs full account access. Approve it once in the Apify console, or runs return 403. The run page shows the reason.
   - **Email:** Resend's testing sender (`onboarding@resend.dev`) only delivers to your Resend account's own address. To send anywhere else, verify a domain at resend.com/domains and set `RESEND_FROM` to an address on it.
4. **Run**
   ```bash
   npm run dev
   ```
5. **Checks** (no keys needed):
   ```bash
   npx tsx scripts/check-sources.mts
   ```
   ```bash
   npx tsx scripts/check-selection.mts
   ```

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string |
| `OPENROUTER_API_KEY` | yes | Every Gemini call goes through OpenRouter |
| `GEMINI_MODEL` | no | Defaults to `google/gemini-3.7-flash`. Must start with `google/` |
| `APIFY_TOKEN` | no | Google Scholar. If it's missing, Scholar is skipped and the UI says so |
| `APIFY_SCHOLAR_ACTOR_ID` | no | Defaults to `marco.gullo~google-scholar-scraper` |
| `RESEND_API_KEY` | no | Email delivery. If it's missing, the PDF still downloads from the brief |
| `RESEND_FROM` | no | Defaults to `Research Pulse <onboarding@resend.dev>`. Without a verified domain, Resend only delivers to your own account address |
| `BRIEF_RECIPIENT_EMAIL` | for email | Recipient address(es), comma-separated |
| `APP_URL` | no | Public URL, used for the link in the email |

Never commit a key. `.env*` files are git-ignored, except `.env.example`.

## Deploy (Vercel)

Import the GitHub repo into Vercel and add the environment variables above. `vercel.json` isn't needed, and there is deliberately no `crons` entry. Each route sets `maxDuration = 60`.

## Tuning the rubric

Ratings are stored per card, and each one joins to that paper's four dimension scores:

```sql
select r.useful, s.shift, s.client_relevance, s.evidence, s.maturity, s.final_score
from ratings r join brief_items b on b.id = r.brief_item_id join scores s on s.paper_id = b.paper_id;
```

Change one weight at a time in `prompts/Research_rubric.txt` and record the change in its change log. The next run uses the new weights. The Settings page shows the parameters currently in effect.
