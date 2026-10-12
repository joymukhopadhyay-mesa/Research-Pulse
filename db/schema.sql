-- Research Pulse schema (Neon Postgres). Safe to run more than once.
create extension if not exists pgcrypto;

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  keywords text[] not null default '{}',          -- last week's keywords prefill the form
  arxiv_categories text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'fetching',         -- fetching | scoring | writing | delivering | ready | failed
  step text not null default 'fetch',              -- fetch | score | select | write | deliver | done
  progress jsonb not null default '{}'::jsonb,     -- per-step counts, per-source/per-domain fetch state
  log jsonb not null default '[]'::jsonb,
  domains jsonb not null default '[]'::jsonb,      -- snapshot of topics at run time
  apify_run_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  word_count int,
  read_minutes int,
  emailed_at timestamptz,
  error text
);

create table if not exists papers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  source text not null,                            -- arxiv | semantic_scholar | google_scholar
  external_id text not null,
  title text not null,
  abstract text,
  url text not null,                               -- always from the source API response
  authors text[] not null default '{}',
  published_at timestamptz,
  domains text[] not null default '{}',            -- domains whose search returned it
  dup_of uuid references papers(id) on delete cascade,  -- set when the same paper came from another source
  norm_key text,                                   -- arxiv:<id> | doi:<doi> | title:<normalised>
  claimed_at timestamptz,                          -- scoring batch lock
  created_at timestamptz not null default now(),
  unique (run_id, source, external_id)
);
create index if not exists papers_run_idx on papers(run_id);
create index if not exists papers_norm_idx on papers(run_id, norm_key);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null unique references papers(id) on delete cascade,
  gate_pass boolean not null default true,
  gate_reason text,
  domains text[] not null default '{}',            -- Gemini's tags, most client-relevant first (S8)
  shift int not null,
  shift_types text[] not null default '{}',
  client_relevance int not null,
  client_questions text[] not null default '{}',
  evidence int not null,
  maturity int not null,
  proof jsonb not null default '{}'::jsonb,
  uncertain boolean not null default false,
  one_line_reason text,
  final_score numeric(3,1) not null                -- computed by code from the rubric weights
);

create table if not exists brief_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  paper_id uuid not null references papers(id) on delete cascade,
  domain text not null,
  rank int not null,
  kind text not null check (kind in ('featured','runner_up')),
  whats_new text,
  why_it_matters text,
  client_angle text,
  evidence_note text,
  verdict text,
  unique (run_id, paper_id)
);
create index if not exists brief_items_run_idx on brief_items(run_id);

create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  headline text not null,
  summary text not null,
  url text not null,                               -- from search grounding citations only
  related_paper_id uuid references papers(id) on delete set null
);

create table if not exists coverage (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  domain text not null,
  scanned int not null default 0,
  gated_out int not null default 0,
  scored int not null default 0,
  selected int not null default 0,
  by_source jsonb not null default '{}'::jsonb,
  unique (run_id, domain)
);

create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  brief_item_id uuid not null unique references brief_items(id) on delete cascade,
  useful boolean not null,
  created_at timestamptz not null default now()
);

-- Starting domains from the brief. Edit them on the Topics page; no redeploy needed.
insert into topics (name, keywords, arxiv_categories) values
  ('AI agents', array['LLM agents','agentic AI','tool use language model','multi-agent LLM'], array['cs.AI','cs.CL','cs.MA']),
  ('Retrieval-augmented generation', array['retrieval-augmented generation','RAG','dense retrieval LLM'], array['cs.CL','cs.IR']),
  ('LLMs for code', array['code generation LLM','program synthesis language model','software engineering agent'], array['cs.SE','cs.CL']),
  ('Computer vision for industrial applications', array['industrial anomaly detection','visual inspection deep learning','defect detection'], array['cs.CV']),
  ('LLM evaluation and benchmarks', array['LLM benchmark','language model evaluation','reasoning benchmark'], array['cs.CL','cs.AI']),
  ('Efficient inference and small models', array['small language model','LLM quantization','efficient inference LLM'], array['cs.LG','cs.CL'])
on conflict (name) do nothing;
