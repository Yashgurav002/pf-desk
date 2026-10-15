-- PF Desk schema (PRD §10.2). Idempotent: safe to run on every start.
create extension if not exists vector;

create table if not exists employers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  establishment_code text,
  contact_name text, contact_phone text,
  cycle_day int not null default 1,
  due_day int not null default 15,       -- [verify with consultant]
  created_at timestamptz default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade,
  uan text,                              -- encrypted at app level
  name_uan text, name_bank text, name_aadhaar text,
  father_name_uan text, father_name_bank text,
  dob_uan date, dob_aadhaar date,
  aadhaar_last4 char(4),                 -- never the full number
  aadhaar_linked boolean,
  pan_present boolean,
  bank_ifsc text, bank_account_enc text, bank_verified boolean,
  kyc_approved_by_employer boolean,
  date_of_joining date, date_of_exit date,
  phone_enc text,
  preferred_language text default 'hi' check (preferred_language in ('hi','mr','en')),
  created_at timestamptz default now()
);

create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  form text not null,
  purpose text,
  status text not null default 'draft'
    check (status in ('draft','checked','submitted','under_process','settled','rejected','resubmitted','closed')),
  submitted_at date, settled_at date, rejected_at date,
  rejection_remark text,
  decoded jsonb,
  risk_pct real, risk_model text,
  eta_days real, eta_low real, eta_high real, eta_model text,
  created_at timestamptz default now()
);

create table if not exists precheck_results (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  issues jsonb not null,
  features jsonb not null,
  created_at timestamptz default now(),
  confirmed_by_consultant boolean
);

create table if not exists history_claims (
  id serial primary key,
  form text, service_months int, age_band text, employer_size_band text,
  name_match real, father_match real, dob_match boolean, bank_verified boolean,
  kyc_approved boolean, aadhaar_linked boolean, exit_marked boolean,
  months_since_exit int, submitted_at date, submit_month int, office_code text,
  outcome text check (outcome in ('settled','rejected')),
  days_to_outcome int,
  rejection_category text
);
alter table history_claims add column if not exists submitted_at date;

create table if not exists salary_uploads (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade,
  wage_month date not null,
  rows jsonb not null,
  validation jsonb,
  status text default 'received' check (status in ('received','validated','paid','archived')),
  created_at timestamptz default now()
);

create table if not exists rules (
  id text primary key,
  title text not null,
  body text not null,
  applies_to text[] not null default '{}',
  params jsonb,
  source text not null,
  last_verified_by text, last_verified_at date,
  embedding vector(768),
  body_tsv tsvector generated always as (to_tsvector('simple', title || ' ' || body)) stored
);
create index if not exists rules_body_tsv_idx on rules using gin (body_tsv);
create index if not exists rules_embedding_idx on rules using hnsw (embedding vector_cosine_ops);

create table if not exists help_links (
  token_hash text primary key,
  employee_id uuid references employees(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists help_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  channel text check (channel in ('text','voice')),
  transcript_redacted jsonb,
  resolved boolean, escalated boolean,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  kind text not null, ref_id uuid, title text not null,
  due_at timestamptz, done boolean default false,
  created_at timestamptz default now()
);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  kind text, model text, tokens_in int, tokens_out int, latency_ms int, trace_id text,
  created_at timestamptz default now()
);

create table if not exists access_log (
  id bigserial primary key, actor text, action text, ref_id uuid, at timestamptz default now()
);

create table if not exists remark_labels (
  id uuid primary key default gen_random_uuid(),
  text text not null unique,
  category text not null,
  fields_involved text[] not null default '{}',
  fix_step_ids text[] not null default '{}',
  source text not null default 'consultant',
  labelled_by text,
  created_at timestamptz default now()
);

-- Phase 4 (Temporal): idempotent task creation (worker replay never duplicates) and once-only outcome recording
alter table tasks add column if not exists body text;
alter table tasks add column if not exists dedupe_key text;
create unique index if not exists tasks_dedupe_key_idx on tasks (dedupe_key);
alter table history_claims add column if not exists claim_id uuid;
-- one row per claim outcome: a claim rejected once and settled after resubmission gives a rejected and a settled row
drop index if exists history_claims_claim_id_idx;
create unique index if not exists history_claims_claim_outcome_idx on history_claims (claim_id, outcome);
