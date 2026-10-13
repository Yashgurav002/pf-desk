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
- [ ] T1.1 `src/pii.ts` — `Pii` tokenizer/detokenizer (names, UAN, Aadhaar, PAN, IFSC, account, phone, email, amounts) + `redact()`
- [ ] T1.2 `src/pii.test.ts` — unit tests + 200-string red-team test, 0 leaks
- [ ] T1.3 `src/checks.ts` — `nameScore()` (token-sort + transliteration/initials aware) and `runChecks()` driven by rule params
- [ ] T1.4 `src/synthetic.ts` — Faker en_IN generator: employers, employees with planted errors, claims, history_claims, remarks
- [ ] T1.5 `src/checks.test.ts` — 20 planted-error cases all caught; no "Low" risk with a blocker

## Phase 1b — Data layer (B-data)
- [ ] T1.6 `src/schema.sql` — PRD §10.2 schema (+ `rules.params jsonb`)
- [ ] T1.7 `src/db.ts` — PGlite/pg adapter, `query()`, `migrate()`
- [ ] T1.8 `src/crypto.ts` — AES-GCM field encryption, HMAC sign/verify, token hashing
- [ ] T1.9 `src/llm.ts` — `chat(messages, pii, opts)` + `embed(text)` + `agent_runs` logging
- [ ] T1.10 `src/search.ts` — hybrid Rule Book search (keyword + vector, RRF k=60)
- [ ] T1.11 `src/seed.ts` — Rule Book seed (PRD §5, marked unverified) + synthetic data load + embeddings
- [ ] T1.12 `src/search.test.ts` — "Form 10C" found by keyword, "pension withdrawal" by meaning

## Phase 1c — API (chief)
- [ ] T1.13 `src/index.ts` — Hono server, passcode login cookie, access log, `/health`
- [ ] T1.14 Employers / employees / claims CRUD (masked identifiers)
- [ ] T1.15 `POST /v1/claims/:id/precheck` — checks + history-baseline risk + ETA
- [ ] T1.16 `POST /v1/claims/:id/message` — Gemma WhatsApp draft hi/mr/en via PII tokenizer
- [ ] T1.17 `POST /v1/claims/:id/decode` — Gemma few-shot Rejection Decoder (fallback until Tinker)
- [ ] T1.18 `GET /v1/today` — Today board sections
- [ ] T1.19 `POST /v1/import/preview` + `POST /v1/import` — xlsx/csv, column mapping, drops full Aadhaar
- [ ] T1.20 Rule Book endpoints: search, list, create, edit (re-embed)
- [ ] T1.21 Help links + text helpline (`/v1/help-links`, `/v1/help/:token`, `/v1/help/:token/message`) with escalation

## Phase 1d — Web UI (C-web)
- [ ] T1.22 Layout, nav, demo banner, login page, `/api/*` proxy to API
- [ ] T1.23 Today board (home)
- [ ] T1.24 Claims list + new claim + claim detail (Pre-check, risk badge, issues, Copy WhatsApp, status, Decoder, help link)
- [ ] T1.25 Employees list
- [ ] T1.26 Import page with column mapping + preview
- [ ] T1.27 Rule Book page (search, edit, unverified badge)
- [ ] T1.28 Employee help page `/help/[token]` (text chat)

## Phase 1e — Integration (chief)
- [ ] T1.29 `pnpm dev` runs both apps; synthetic data loads; smoke-test every endpoint
- [ ] T1.30 Typecheck + tests green; README with run instructions
- [ ] T1.31 Commit

---

## Later phases (blocked on keys / credits / dad's input)
- [ ] P0 Interview dad, verify Rule Book entries (§2.3, §5) — **needs dad**
- [ ] P0 Claim promos, TabPFN key, domain — **needs you**
- [ ] P2 TabPFN risk + ETA with baselines → `evaluation/tabpfn.md` (replaces history-baseline)
- [ ] P3 Decoder: label tool, dataset, Tinker LoRA, eval → `evaluation/decoder.md`
- [ ] P4 Temporal MonthlyCycle + ClaimFollowUp workflows; salary upload validation (F5)
- [ ] P4 ElevenLabs voice helpline; Sentry tracing; Render deploy + domain
- [ ] P4 Hindi/Marathi UI label toggle
- [ ] P5–7 Real use, benchmarks (§20), video, DEV post

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
