# PF Desk

Private back office for Provident Fund consultants: pre-checks claims before EPFO rejects them, decodes rejection remarks, estimates settlement dates, and answers employees in Hindi / Marathi / English. Open models only (Gemma via Ollama); real data stays on the consultant's machine.

> PF Desk helps consultants prepare and check. It does not file with EPFO, and it is not legal or financial advice. Rules change: always verify with the latest EPFO circulars.

Spec: [`PFDESK_PRD.md`](PFDESK_PRD.md) · Progress: [`TASKS.md`](TASKS.md)

## Run locally

Needs Node 24+, pnpm, and [Ollama](https://ollama.com) with `gemma3:4b` and `nomic-embed-text`.

```sh
ollama pull gemma3:4b && ollama pull nomic-embed-text
pnpm install
pnpm --filter tabpfn setup  # Python venv for TabPFN (CPU torch); optional — API falls back to baselines
cp .env.example .env      # DEMO_MODE=true loads synthetic data
pnpm dev                  # web http://localhost:3000 (passcode: demo), API :8787, TabPFN :8790
pnpm seed                 # wipe and reload synthetic demo data
pnpm test
```

No Docker needed: the database is embedded Postgres (PGlite + pgvector) in `.data/`. To use real Postgres / Tiger Cloud, set `DATABASE_URL` (`docker compose up db` gives you one on port 5433).

## Real data (local mode)

Set `DEMO_MODE=false`, a strong `CONSULTANT_PASSCODE`, and generate `APP_ENCRYPTION_KEY` and `HELP_LINK_SECRET`:

```sh
node -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

UAN, bank account and phone are encrypted at rest; only the last 4 Aadhaar digits are kept; every model prompt goes through the PII tokenizer (`apps/api/src/pii.ts`).

## Layout

- `apps/api` — Hono API (Node 24 runs the TypeScript directly). `pii.ts` tokenizer, `checks.ts` Pre-check rules, `search.ts` hybrid Rule Book search, `synthetic.ts` demo data.
- `apps/web` — Next.js + Tailwind UI. `/api/*` is proxied to the API.

- `ml/tabpfn` — TabPFN service (`serve.py`) for rejection risk and settlement ETA, and `train_eval.py` (time-ordered split vs baselines → [`evaluation/tabpfn.md`](evaluation/tabpfn.md)). Only de-identified columns are ever sent to it. Uses open TabPFN v2 on CPU by default; set `TABPFN_TOKEN` (local v3.5) or `TABPFN_MODE=api` + `TABPFN_API_KEY` (Prior Labs cloud). If the service is down, the API uses history baselines and says so in the UI.

```sh
cd apps/api && pnpm export-history   # history_claims -> ml/tabpfn/history.csv
pnpm --filter tabpfn eval            # writes evaluation/tabpfn.md
```

## Monthly cycle (Temporal)

Per employer and wage month, `MonthlyCycleWorkflow` (`apps/api/src/workflows.ts`, id `cycle-<employerId>-<YYYY-MM>`) creates tasks on the **Cycle** page: request the salary sheet (draft WhatsApp text) on `cycle_day`, chase it at `due_day - 5`, review the validation, and "Payment due today" on `due_day` until you tap **Mark paid**. Submitting a claim starts `ClaimFollowUpWorkflow` (`claim-<claimId>`): overdue vs the ETA, "Fix and resubmit" on rejection, and every settled or rejected claim becomes a new `history_claims` row (TabPFN training data grows with use).

- Salary sheets (`.xlsx`/`.csv`; UAN or employee code, name, gross, Basic+DA, days worked) are validated in `salary.ts` with rates from the Rule Book params (`R-CONTRIB-SPLIT`, `R-WAGE-CEILING`, `R-EDLI`, `R-ADMIN`) and flagged against last month. Aadhaar/account columns are ignored.
- `pnpm dev` starts `temporal server start-dev` (state in `.data/temporal.db`, UI http://localhost:8233) if the [Temporal CLI](https://docs.temporal.io/cli) is on PATH or in `.tools/`. The worker runs inside the API (PGlite is one process per data dir); with `DATABASE_URL` you can set `TEMPORAL_WORKER=off` and run `pnpm --filter api worker`.
- Without Temporal everything still works (upload, validation, Mark paid); the API logs once and skips starts/signals.
- `CYCLE_FAST=N` makes a cycle "day" last N seconds (demos). Kill-resume check: `cd apps/api && node src/durability.ts 20` (needs a running Temporal server) → [`evaluation/durability.md`](evaluation/durability.md).

## Rejection Decoder (Tinker fine-tune)

`ml/decoder`: Qwen3-8B + LoRA trained on Tinker turns an EPFO remark into `{category, fields_involved, fix_step_ids}` (20 categories, `labels.json`); Gemma then writes the hi/mr/en employee messages. On the laptop it runs as Ollama's `qwen3:8b` file + the LoRA under llama-server (`export.py`, [`export.md`](ml/decoder/export.md)); without it the API falls back to Gemma few-shot.
Evaluated on a synthetic test set ([`evaluation/decoder.md`](evaluation/decoder.md)) **and** on 148 real remarks members posted publicly, never used for training ([`evaluation/decoder_public.md`](evaluation/decoder_public.md)).

## Rules and research

Every Rule Book entry carries its source; they were checked against EPFO / PIB / gazette sources as of Oct 2026, including the EPF Scheme, 2026 and the ₹25,000 wage ceiling ([`docs/research/rules.md`](docs/research/rules.md)). Problem and market evidence: [`docs/research/problem.md`](docs/research/problem.md). Unverified rules say so; the consultant can mark a rule verified in the Rule Book, and re-seeding never overwrites a verified rule.

## Employee helpline (text + voice)

`/help/<token>` links (signed, 30 days) answer status and document questions from the claim facts, ETA and Rule Book only; anything else, and any rejected claim, goes to the consultant as a task. Voice is optional: create an ElevenLabs agent with **Custom LLM** = `<API_URL>/v1/voice/llm/chat/completions` (needs a public URL), secret = `VOICE_SHARED_SECRET`, and put `help_token: {{help_token}}` in its system prompt; set `ELEVENLABS_AGENT_ID` and the help page shows the voice widget.

## Observability

Set `SENTRY_DSN_API` to trace every model call (`llm.<kind>` spans) and TabPFN call, and capture API errors. Only metadata is sent (kind, model, timings, counts), never prompts, answers or identifiers.

## Benchmarks (PRD §20)

| # | What | Result | Command |
|---|---|---|---|
| 1–2 | Rejection risk + ETA (TabPFN vs baselines) | [`evaluation/tabpfn.md`](evaluation/tabpfn.md) | `pnpm --filter tabpfn eval` |
| 3 | Rejection Decoder | [`decoder.md`](evaluation/decoder.md), [`decoder_public.md`](evaluation/decoder_public.md) | `ml/decoder: python eval.py` |
| 4 | Pre-check recall / false alarms | [`evaluation/precheck.md`](evaluation/precheck.md) | `pnpm --filter api bench:checks` |
| 5 | PII red-team (200 strings) | `apps/api/src/pii.test.ts` | `pnpm test` |
| 6 | Rule Book search Recall@5 | [`evaluation/search.md`](evaluation/search.md) | `pnpm --filter api bench:search` |
| 7 | Helpline | [`evaluation/helpline.md`](evaluation/helpline.md) | `pnpm --filter api bench:helpline` |
| 8 | Kill-resume durability | [`evaluation/durability.md`](evaluation/durability.md) | `cd apps/api && node src/durability.ts 20` |

Deploy (Render + domain) is in `TASKS.md`.
