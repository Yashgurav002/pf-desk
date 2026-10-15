# PF Desk — Task Board

Source of truth: `PFDESK_PRD.md`. Tick `[x]` when done **and verified**. Owner tags: `chief` (main agent), `A-core`, `B-data`, `C-web` (sub-agents).

**Stack decisions**
- pnpm monorepo: `apps/api` (Hono, Node 24 native TS, no build step) + `apps/web` (Next.js + Tailwind).
- DB: embedded **PGlite** (Postgres + pgvector, no Docker) by default; `DATABASE_URL` switches to real Postgres / Tiger Cloud. `docker-compose.yml` is optional.
- PRD `packages/*` folded into `apps/api/src/*.ts` modules (fewer files); split out later if needed.
- LLM: Ollama OpenAI-compatible (`gemma3:4b`, `nomic-embed-text`). Every LLM call takes a `Pii` instance (enforced by type).
- Mastra, Temporal, TabPFN, Tinker, ElevenLabs, Sentry = later phases (need keys/credits/dad's data).
- Domain: TBD (user will provide) — keep it in env (`PUBLIC_URL`), never hard-coded.

---

## Phase 0 — Scaffold (chief)
- [x] T0.1 Root workspace: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.env.example` (+ `.env`), `docker-compose.yml`
- [x] T0.2 `apps/api` package + tsconfig + deps installed
- [x] T0.3 `apps/web` package + Next/Tailwind deps installed
- [x] T0.4 CI workflow (`.github/workflows/ci.yml`: typecheck + tests)
- [x] T0.5 `git init` + first commit

## Phase 1a — Core logic, pure modules (A-core)
- [x] T1.1 `src/pii.ts` — `Pii` tokenizer/detokenizer (names, UAN, Aadhaar, PAN, IFSC, account, phone, email, amounts) + `redact()`
- [x] T1.2 `src/pii.test.ts` — unit tests + 200-string red-team test, 0 leaks
- [x] T1.3 `src/checks.ts` — `nameScore()` (token-sort + transliteration/initials aware) and `runChecks()` driven by rule params
- [x] T1.4 `src/synthetic.ts` — Faker en_IN generator: employers, employees with planted errors, claims, history_claims, remarks
- [x] T1.5 `src/checks.test.ts` — 20 planted-error cases all caught; no "Low" risk with a blocker

## Phase 1b — Data layer (B-data)
- [x] T1.6 `src/schema.sql` — PRD §10.2 schema (+ `rules.params jsonb`)
- [x] T1.7 `src/db.ts` — PGlite/pg adapter, `query()`, `migrate()`
- [x] T1.8 `src/crypto.ts` — AES-GCM field encryption, HMAC sign/verify, token hashing
- [x] T1.9 `src/llm.ts` — `chat(messages, pii, opts)` + `embed(text)` + `agent_runs` logging
- [x] T1.10 `src/search.ts` — hybrid Rule Book search (keyword + vector, RRF k=60)
- [x] T1.11 `src/seed.ts` — Rule Book seed (PRD §5, marked unverified) + synthetic data load + embeddings
- [x] T1.12 `src/search.test.ts` — "Form 10C" found by keyword, "pension withdrawal" by meaning

## Phase 1c — API (chief)
- [x] T1.13 `src/index.ts` — Hono server, passcode login cookie, access log, `/health`
- [x] T1.14 Employers / employees / claims CRUD (masked identifiers)
- [x] T1.15 `POST /v1/claims/:id/precheck` — checks + history-baseline risk + ETA
- [x] T1.16 `POST /v1/claims/:id/message` — Gemma WhatsApp draft hi/mr/en via PII tokenizer
- [x] T1.17 `POST /v1/claims/:id/decode` — Gemma few-shot Rejection Decoder (fallback until Tinker)
- [x] T1.18 `GET /v1/today` — Today board sections
- [x] T1.19 `POST /v1/import/preview` + `POST /v1/import` — xlsx/csv, column mapping, drops full Aadhaar
- [x] T1.20 Rule Book endpoints: search, list, create, edit (re-embed)
- [x] T1.21 Help links + text helpline (`/v1/help-links`, `/v1/help/:token`, `/v1/help/:token/message`) with escalation

## Phase 1d — Web UI (C-web)
- [x] T1.22 Layout, nav, demo banner, login page, `/api/*` proxy to API
- [x] T1.23 Today board (home)
- [x] T1.24 Claims list + new claim + claim detail (Pre-check, risk badge, issues, Copy WhatsApp, status, Decoder, help link)
- [x] T1.25 Employees list
- [x] T1.26 Import page with column mapping + preview
- [x] T1.27 Rule Book page (search, edit, unverified badge)
- [x] T1.28 Employee help page `/help/[token]` (text chat)

## Phase 1e — Integration (chief)
- [x] T1.29 `pnpm dev` runs both apps; synthetic data loads; smoke-test every endpoint
- [x] T1.30 Typecheck + tests green; README with run instructions
- [x] T1.31 Commit

---

## Phase 1 follow-ups (found during integration)
- [x] Seeded open claims are pre-checked on demo boot so the Today board isn't empty
- [x] Form-code queries ("Form 10C") rank the exact form first (keyword leg weighted x3)
- [x] Helpline: ETA computed for submitted claims; "no estimate → no date" guard (model had invented a date)
- [x] Helpline: off-topic questions (loans, advice) get a fixed "consultant will call" reply + escalation
- [x] Next proxy timeout raised to 180s (cold Gemma calls take ~55s)
- [x] Web risk badge: API sends 0..1 fraction; bands aligned with API
- [ ] Visual click-through of the UI in a browser (Chrome extension wasn't connected)
- [ ] Decide: should the helpline answer *rule* questions from the Rule Book, or always escalate them? (currently escalates)
- [ ] Hindi/Marathi message quality review — **needs dad**

## Phase 2 — TabPFN risk + ETA, Gemma explanations
- [x] T2.1 `history_claims.submitted_at` (time-ordered split needs a date); synthetic history spread over ~18 months
- [x] T2.2 `pnpm --filter api export-history` → `ml/tabpfn/history.csv` (de-identified columns only; gitignored)
- [x] T2.3 `ml/tabpfn/serve.py` — stdlib HTTP service: `POST /predict` {task, train, rows} → probabilities / ETA quantiles; `TABPFN_MODE=local|api`
- [x] T2.4 `ml/tabpfn/train_eval.py` — time-ordered split; baselines (form rate, logistic regression, gradient boosting; ETA median-per-form); ROC-AUC, Brier, precision@high-risk, ETA MAE + interval coverage → `evaluation/tabpfn.md`
- [x] T2.5 API `predictRisk` / `predictEta` call the service, fall back to the history baseline when it's down; model name shown in UI
- [x] T2.6 `POST /v1/claims/:id/explain` — Gemma colleague-style explanation of issues + risk (context-first, PII-tokenized, cites rule ids) + button on claim page
- [x] T2.7 `pnpm dev` also starts the TabPFN service; README + `.env.example` updated
- [x] T2.8 Verify end to end, tests green, commit
- [ ] T2.11 TabPFN ETA interval is too narrow (50% p20–p80 coverage vs ~60% expected) — widen (e.g. p10–p90) after real data
- [ ] T2.12 API mode (`TABPFN_MODE=api`) written but untested; `tabpfn-client` needs pandas<3 — **needs TabPFN API key**
- [x] T2.13 Hinglish Excel template for dad: `docs/PF_Desk_Papa_Template.xlsx` (past claims + rejection remarks; built by `docs/make_papa_template.py`)
- [ ] T2.14 Importer: template → `history_claims` + `remark_labels` (when dad returns it)
- [ ] T2.9 Real history from dad's records into `history_claims` (150+ rows) — **needs dad**
- [ ] T2.10 Dad approves a Hindi message — **needs dad**

## Phase 3 — Rejection Decoder fine-tuned with Tinker
Design: fine-tuned **Qwen3-8B** (Tinker LoRA) does extraction — remark → `{category, fields_involved, fix_step_ids}`; Gemma writes the hi/mr/en messages from that (context-first). Small model stays small; messages stay editable.
- [x] T3.1 Label tool: `/label` page in the web app + `remark_labels` table + API (dad picks category + fix steps; import/export JSONL)
- [x] T3.2 Seed remark pool: 40 hand-written synthetic remarks + per-category template grammar (EPFO-style abbreviations, caps, terse wording) → `ml/decoder/data/remarks.jsonl`
- [x] T3.3 `ml/decoder/build_dataset.py` — merge dad's labels (preferred) + synthetic pool; augment (case, abbreviations, typos, punctuation); **grouped** 70/30 split by source remark (no leakage); 25 hard cases kept in test
- [x] T3.4 `ml/decoder/tinker_train.py` — LoRA SFT on Qwen3-8B (thinking off, cookbook renderer), logs loss, saves sampler weights, writes run id
- [x] T3.5 `ml/decoder/eval.py` — base Qwen3-8B zero-shot vs Gemma 3 4B few-shot vs fine-tuned: macro-F1, JSON validity, p50 latency, cost/1k → `evaluation/decoder.md`
- [x] T3.6 Export: adapter → PEFT → GGUF LoRA → llama-server on Ollama's qwen3:8b file (`ml/decoder/export.md`; Ollama 0.17 rejects LoRA)
- [x] T3.7 API decode: fine-tuned extraction (DECODER_MODEL) + Gemma messages; Gemma few-shot fallback when the decoder isn't installed
- [x] T3.8 Verify end to end, tests green, commit (decoder v3: Tinker + laptop llama-server rows in decoder.md / decoder_public.md)
- [ ] T3.9 Dad labels 150–400 real remarks with the label tool, then retrain — **needs dad**
- [ ] T3.10 Dad rates 20 decoded messages 1–5 — **needs dad**
- [ ] T3.0 `TINKER_API_KEY` in `.env` — **needs you** (Tinker console → API keys)

## Phase R — Research instead of dad (2026-10-15: user asked to finish without dad; merge dad's input later if available)
- [x] R1 Verify all 25 Rule Book entries against official EPFO / Labour Ministry / PIB sources (current to Oct 2026) → `docs/research/rules.md`; seed gets per-rule `source` + corrected bodies/params (agent R-rules)
- [x] R2 Real public EPFO rejection remarks (forums, news, EPFO FAQs; verbatim, no PII, source URL each), labelled → `ml/decoder/data/public_remarks.jsonl` (agent R-remarks)
- [x] R3 Problem evidence + market: rejection-rate stats, settlement times, grievances, consultant fees, competitors → `docs/research/problem.md` (agent R-remarks)
- [x] R4 Eval decoder on the real public remarks (base + tuned on Tinker, Gemma few-shot) → "real remarks" table in `evaluation/decoder.md` (chief)
- [x] R5 Rule-driven check changes from R1 (e.g. waiting period, service thresholds) + tests (chief)

## Phase 4 — no-key parts first
- [x] P4.1 Temporal: `MonthlyCycleWorkflow` + `ClaimFollowUpWorkflow` (PRD §13), worker, signals from UI status changes, dev server via `temporal server start-dev`; falls back cleanly when Temporal is not running (agent B-temporal)
- [x] P4.2 F5 salary sheet upload + validation (wage ceiling, split, EDLI, admin, anomalies vs last month) + Cycle page (agent B-temporal)
- [x] P4.3 Hindi/Marathi UI label toggle (agent C-i18n)
- [x] P4.4 Sentry tracing, env-gated (no-op without DSN) (chief)
- [x] P4.5 ElevenLabs custom-LLM endpoint + voice widget on help page, env-gated (chief)
- [x] P4.6 Benchmarks §20: #4 pre-check false alarms, #6 hybrid search Recall@5 (30 questions), #7 helpline correctness, #8 kill-resume 20× (chief)
- [x] P4.7 Render deploy + domain: https://pfdesk.buildwithyash.tech (Render free plan, Tiger Cloud free Postgres, Gemma 4 via Google AI Studio). Verified 2026-10-15: login, Today, claims, Pre-check, explain, WhatsApp draft, decoder, help link all work.
- [ ] P4.12 Live helpline slow on Google free tier (24–94 s; one Hindi status question misrouted as off-topic). Try a faster Gemma model or accept + record video locally.
- [x] P4.8 Decoder taxonomy 15 → 20 categories after the public-remarks study (pension/EPS, contribution, transfer, PAN/15G, employer confirmation); retrained on Tinker (v2, v3)
- [x] P4.9 Helpline fixes found by the benchmark: fixed reply for rejected claims, foreign-script retry, EPFO offices/staff = off-topic
- [x] P4.10 Rejected claims also recorded into history_claims by ClaimFollowUpWorkflow (one row per claim + outcome)
- [ ] P4.11 Voice: create the ElevenLabs agent (custom LLM → `/v1/voice/llm/chat/completions`, Bearer = VOICE_SHARED_SECRET, system prompt contains `help_token: {{help_token}}`) — **needs you** (ElevenLabs key) + a public URL

## Later phases (blocked on keys / credits / dad's input)
- [ ] P0 Interview dad, verify Rule Book entries (§2.3, §5) — **needs dad**
- [ ] P0 Claim promos, TabPFN key, domain — **needs you**
- [x] P4 Temporal MonthlyCycle + ClaimFollowUp workflows; salary upload validation (F5)
- [ ] P4 ElevenLabs voice helpline; Sentry tracing; Render deploy + domain
- [x] P4 Hindi/Marathi UI label toggle
- [ ] P5 Dad tries the live demo (10 min): one Pre-check + quote + ₹499/₹999 answer — **needs you + dad**
- [ ] P6 Demo video (3 min, record locally with `pnpm dev` for speed) — script by chief, recording **needs you**
- [ ] P7 DEV post draft (chief) → publish + submit by Sun Oct 18 night IST (cutoff Mon Oct 19 ~12:29 PM IST) — **needs you**
- [ ] Optional: Sentry DSN, ElevenLabs voice agent

---

## Shared contracts (sub-agents code against these)

```ts
// pii.ts
export type PiiKind = 'NAME'|'UAN'|'AADHAAR'|'PAN'|'IFSC'|'ACC'|'PHONE'|'EMAIL'|'AMT'|'ID';
export class Pii { constructor(known?: {kind: PiiKind; value: string}[]); add(kind, value): string /*token*/; tokenize(text: string): string; detokenize(text: string): string }
export function redact(text: string): string;

// checks.ts
export type Severity = 'blocker'|'warning';
export type Issue = { code: string; severity: Severity; field: string; message: string; fix: string; rule_id: string };
export type EmployeeFacts = { name_uan, name_bank, name_aadhaar, father_name_uan, father_name_bank: string|null; dob_uan, dob_aadhaar: string|null /*YYYY-MM-DD*/; aadhaar_linked, bank_verified, kyc_approved_by_employer: boolean|null; bank_ifsc: string|null; bank_account: string|null /*decrypted*/; date_of_joining, date_of_exit: string|null };
export type ClaimFacts = { id?: string; form: string; status?: string };
export type Rule = { id: string; title: string; params: Record<string, any> | null };
export function nameScore(a: string, b: string): { equal: boolean; score: number }; // equal after normalisation; score 0..1 with initials expanded
export function runChecks(emp: EmployeeFacts, claim: ClaimFacts, rules: Rule[], otherClaims: ClaimFacts[], today?: string): Issue[];
export function features(emp: EmployeeFacts, claim: ClaimFacts, today?: string): Record<string, number|string|boolean>; // de-identified, matches history_claims columns

// synthetic.ts
export const ERROR_KINDS: readonly ['name_mismatch','father_name_mismatch','dob_mismatch','bank_not_verified','kyc_not_approved','aadhaar_not_linked','ifsc_invalid','exit_date_missing'];
export type ErrorKind = typeof ERROR_KINDS[number];
export function makeEmployee(planted?: ErrorKind[], seed?: number): EmployeeFacts & { uan: string; phone: string; aadhaar_last4: string; pan_present: boolean; preferred_language: 'hi'|'mr'|'en'; planted: ErrorKind[] };
export function makeDataset(seed?: number): { employers: {...}[]; employees: (...& {employer_idx: number})[]; claims: {...& {employee_idx: number}}[]; history: {...history_claims columns}[] };
export const REMARKS: { text: string; category: string }[]; // realistic synthetic EPFO-style rejection remarks

// db.ts
export async function query<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
export async function migrate(): Promise<void>;
// crypto.ts
export function enc(plain: string|null): string|null; export function dec(cipher: string|null): string|null;
export function sign(payload: string): string; export function verify(signed: string): string|null;
export function newToken(): { token: string; hash: string }; export function hashToken(token: string): string;
// llm.ts
export async function chat(messages: {role:'system'|'user'|'assistant'; content: string}[], pii: Pii, opts?: { json?: boolean; model?: string; baseUrl?: string; kind?: string }): Promise<string>;
export async function embed(text: string, kind: 'query'|'document'): Promise<number[]|null>; // null if model unavailable
// search.ts
export async function searchRules(q: string, limit?: number): Promise<(RuleRow & { score: number })[]>;
```

API endpoints (web consumes via `/api` prefix → proxied): PRD §11 subset — see T1.13–T1.21.
