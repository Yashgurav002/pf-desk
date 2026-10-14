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

The Tinker decoder, Temporal, voice and deploy are later phases in `TASKS.md`.
