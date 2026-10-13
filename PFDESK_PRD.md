# PF Desk — PRD & Build Spec

> **Fewer rejected PF claims. Fewer "PF kab aayega?" calls.**
> PF Desk is a private, open-model assistant for Provident Fund consultants. It checks every claim for mistakes before it reaches EPFO, predicts which claims will be rejected and how long settlement will take, decodes rejection remarks into fix steps, runs the monthly compliance cycle for every client, and answers employees' questions in Hindi, Marathi or English, without sending Aadhaar, bank or salary data to a closed AI provider.

**Challenge:** Hacktoberfest Open-Source AI Challenge, Week 2 — "Side Hustle": build something with open-source AI that someone would actually pay for.
**Deadline:** Sunday, October 18, 2026, 11:59 PM PDT = **Monday, October 19, ~12:29 PM IST**. Aim to submit Sunday night IST.
**First user:** the builder's dad, a practising PF consultant in Vasai.
**Goal:** win the Overall prize and several partner prizes **and** keep it as a real side hustle.

**Assumptions about the builder (edit if wrong):** comfortable with TypeScript and basic Python; 4–6 hours a day until Sunday; laptop with 8–16 GB RAM, no GPU; speaks Hindi, Marathi and English.

**Ground rules**
1. **Zero personal spending.** Only free tiers, no-card trials, and the Hacktoberfest partner promos (Tinker, Render, Backboard, .tech domain) from hacktoberfest.com/my/promos. Promos are optional; every feature has a free fallback.
2. **Real data never goes to a closed AI API.** Real client data is processed by open models running on the consultant's own machine or server. The public demo uses synthetic data only.
3. **Open models at the core.** Gemma does the language work; TabPFN does the prediction; a Tinker fine-tune does the decoding.
4. **[verify]** marks anything written from training knowledge without web access (reliable to about mid-2026). **[verify with dad]** marks PF rules and practice that only a working consultant can confirm. EPFO rules change; never hard-code a rule without a source.

---

## 0. How to use this file for vibe coding

- Put this file in the repo root. Tell your coding agent: *"Read PFDESK_PRD.md. Build only Phase N from Section 19. Stop when its acceptance checks pass."*
- Never let the agent invent EPFO rules, rates, form fields or file formats. Rules live in an editable **Rule Book** (Section 5) that your dad reviews.
- Never put real Aadhaar, PAN, bank or salary data into prompts for cloud tools, coding agents, screenshots or the DEV post. Use the synthetic dataset (Section 10.3).
- Commit after each passing phase. Keep Entire recording sessions from the first commit.

---

## 1. Summary

**Name:** PF Desk · **Domain:** `pfdesk.tech` (free first year via promo [verify availability]; **turn off auto-renew**, it renews at $29.99/year)

**One-line pitch:** A private back office for PF consultants: catches claim mistakes before EPFO does, tells employees when their money will arrive, and runs every client's monthly filing cycle, using open models that keep Aadhaar and bank data in the consultant's hands.

**Who pays:** independent PF/ESIC consultants (there are many across India, often serving 20–200 small employers each) and small employers who handle PF themselves. Pricing hypothesis: **₹499–999 per month per consultant**, or a per-claim fee for small users. Validate this with real consultants (Section 2.4).

**The one wow moment:** your dad enters an employee's claim. PF Desk flags that the father's name on the bank record doesn't match the UAN record, predicts a **78% chance of rejection** (example number), and drafts a Hindi WhatsApp message asking the employee for the corrected document. Then the employee opens a help link, asks out loud in Hindi *"Mera PF kab aayega?"*, and hears: *"Your claim was submitted on 14 October. Similar claims usually settle in about 12 days, so expect it around 26 October."* Real consultant, real workflow, private by design.

**Why this wins:**
1. **It will be used.** A working consultant uses it daily from day one. "Bonus points if you land your first user" is satisfied with real usage numbers.
2. **The strongest "why open" story in the hackathon.** Aadhaar, PAN, bank accounts and salaries are exactly the data that should never leave the consultant's control.
3. **Nobody else will build it.** It's niche, specific and Indian, with a clear buyer.
4. **Writing quality comes free.** "I built my dad's PF practice a back office" is a story judges remember.
5. **Partners do real jobs.** TabPFN predicts, Tinker decodes, Gemma explains, Temporal runs the monthly cycle, ElevenLabs answers employees, Tiger Data searches the Rule Book.

---

## 2. Users and problem

### 2.1 Personas
| Persona | Who | What they need |
| --- | --- | --- |
| **Consultant (primary, pays)** | Your dad: handles PF for many small employers, files monthly returns, submits and follows up on member claims, answers endless calls | Fewer rejected claims, less repetitive calling, never missing a client's due date |
| **Employer (client of the consultant)** | Small business owner or their accountant | Send salary data once, get told what to pay and when |
| **Employee (member)** | Worker whose PF is being withdrawn or transferred | To know what's happening with their money, in their language, without calling repeatedly |

### 2.2 Pain points (hypotheses — confirm in the interview)
1. **Claim rejections.** A small mismatch (name spelling, father's name, date of birth, bank details, KYC not approved, exit date missing) gets a claim rejected weeks later. Each rejection means re-filing, angry employees and lost time.
2. **Cryptic rejection remarks.** EPFO remarks are terse and inconsistent; turning them into "what exactly to fix" takes experience.
3. **Status calls.** Employees call repeatedly asking when their money will come.
4. **Monthly cycle juggling.** Chasing many clients for salary data, checking contributions, reminding them before the due date, tracking who has paid.
5. **Rule changes.** EPFO circulars change rules; keeping up is hard.

### 2.3 Interview your dad (Day 1, 30 minutes, introvert-friendly script)
Ask exactly these, take notes, don't pitch:
1. "Walk me through the last claim that got rejected. What happened, start to finish?"
2. "What are the 5 most common rejection reasons you see?"
3. "How many claims do you file in a month? How many get rejected?"
4. "How many calls a day do you get from employees asking about status? What do they ask?"
5. "What does your monthly cycle look like for one client? Where do things go wrong?"
6. "Where do you keep records today? Excel, register, WhatsApp, the portal?"
7. "If something saved you X hours a week, what would it be worth to you per month?"
8. "Can you introduce me to two other consultants for 10 minutes each?"

Also collect (anonymised, Section 6): past claims with outcomes, past rejection remarks, one or two clients' monthly salary sheets.

### 2.4 Validation with other consultants (Saturday, 10 minutes each)
Show the demo, then ask: "Would this save you time? Which part? Would you pay ₹499 a month? ₹999? What's missing?" Record answers verbatim for the DEV post. Introvert tip: you're not selling, you're asking for advice. People love giving advice.

---

## 3. Goals, non-goals, success metrics

**Goals (this week)**
- Your dad uses PF Desk on real work for at least 2 days.
- At least 2 other consultants see it and answer the pricing question.
- Measurable model results for TabPFN and the Tinker fine-tune.
- Public demo on `pfdesk.tech` with synthetic data.

**Non-goals**
- No automation of the EPFO portal: no scraping, no CAPTCHA solving, no logging in on anyone's behalf. Consultants file on the portal themselves; PF Desk prepares and checks.
- No legal or financial advice to employees beyond explaining status and documented rules; anything unclear escalates to the consultant.
- No storage of full Aadhaar numbers or Aadhaar images.

**Success metrics (report real numbers in the post)**
| Metric | How measured |
| --- | --- |
| Claims pre-checked by your dad | Count in app |
| Issues caught before submission | Count of flags he confirmed were real |
| Estimated rejections avoided | Flags confirmed × his historical rejection rate for that issue |
| Employee questions answered without a call | Helpline sessions resolved without escalation |
| Monthly cycle | Clients tracked; reminders sent; due dates missed (target 0) |
| Willingness to pay | Answers from consultants, verbatim |
| Model quality | Section 20 benchmarks |

---

## 4. Features

| ID | Feature | Priority |
| --- | --- | --- |
| F1 | **Claim Pre-check**: mismatch checks + rejection risk + fix checklist + employee message | Must |
| F2 | **Rejection Decoder**: paste EPFO remark → category, fields, fix steps, messages (Tinker fine-tune) | Must |
| F3 | **Settlement ETA**: predicted days to settlement for each submitted claim (TabPFN) | Must |
| F4 | **Today board**: one screen of what to do today | Must |
| F5 | **Monthly compliance cycle** per employer (Temporal) | Must |
| F6 | **Employee helpline**: text first, then voice, in Hindi/Marathi/English, via a private link | Must (text) / Should (voice) |
| F7 | **Rule Book** with hybrid search and sources, editable by the consultant | Must |
| F8 | **Import** employees and claims from Excel/CSV | Must |
| F9 | **Local mode**: everything runs on the consultant's laptop with Ollama | Should |
| F10 | **Rule-change radar**: weekly EPFO news and circular digest via SerpApi | Nice |
| F11 | **Model comparison** of open models on a synthetic eval set via Backboard | Nice |

### F1 — Claim Pre-check
**Input:** employee record (from import or form) + claim type (Form 19, 10C, 31, 13, others [verify with dad]) + optional exit date, purpose, amount.
**Checks (deterministic code, from the Rule Book):**
- Name match across UAN record, bank record and Aadhaar-verified name: fuzzy similarity (token-sort ratio + transliteration-aware normalisation, e.g. "Mohd" ↔ "Mohammed", initials). Thresholds configurable.
- Father's/spouse's name match, same method.
- Date of birth equal across records.
- Bank: IFSC format valid (`^[A-Z]{4}0[A-Z0-9]{6}$`), account number length plausible, bank KYC marked verified.
- KYC approval by employer recorded; Aadhaar linked to UAN (yes/no flag, never the number).
- Exit date present when the claim type needs it; waiting-period and service-length eligibility per Rule Book [verify with dad].
- Duplicate or already-settled claim check.
**Prediction:** TabPFN rejection probability from de-identified features (Section 14).
**Output:** risk badge (Low/Medium/High + %), list of issues each with a fix step and the Rule Book source, and a ready-to-send employee message in Hindi, Marathi or English (Gemma), e.g. asking for a corrected cancelled cheque.
**Acceptance:** for 20 synthetic cases with planted errors, every planted error is caught; zero false "Low risk" on cases with a hard blocker.

### F2 — Rejection Decoder
**Input:** the rejection remark text as it appears on the portal (pasted, or typed from a screenshot by the consultant).
**Output (JSON):** `category` (one of ~15, Section 15), `fields_involved`, `fix_steps` (IDs from the Rule Book), `employee_message_hi`, `employee_message_mr`, `employee_message_en`, `confidence`.
**Model:** small open model fine-tuned with Tinker; fallback: Gemma with few-shot examples.
**Acceptance:** beats both baselines on the held-out set (Section 20).

### F3 — Settlement ETA
For each submitted claim: TabPFN regression of days to settlement from de-identified features, shown as "likely by 26 Oct (range 21–30 Oct)". Updated when the consultant marks status changes. Used by the helpline.

### F4 — Today board
One screen: claims with high risk not yet fixed · claims waiting on employee documents · newly rejected claims (decoded) · clients who haven't sent salary data · payments due within 3 days · employee questions escalated. Each row has one primary action.

### F5 — Monthly compliance cycle
Per employer, a Temporal workflow (Section 13):
1. On the configured day (default 1st), remind the employer to send the salary sheet (WhatsApp message drafted for the consultant to forward, or email).
2. On upload: validate contributions against the Rule Book (wage ceiling, employee/employer split, pension share, EDLI, admin charges [verify all rates with dad]); flag anomalies vs previous months (new joiners/leavers, wage jumps, missing employees).
3. Produce a checked summary and a draft return file **only if** the exact format is confirmed with your dad [verify]; otherwise a validated table he can copy from.
4. Remind before the due date (default: 15th of the following month [verify]); escalate if unpaid.
5. Mark paid when the consultant confirms; archive.

### F6 — Employee helpline
- The consultant generates a private help link per employee (signed token, expires in 30 days) and sends it on WhatsApp.
- The employee opens it and asks by text or voice in Hindi, Marathi or English.
- The agent can only see that employee's claims (masked), the ETA, and the Rule Book. It answers status, next steps, documents needed, and general rules with sources.
- It never reveals identifiers, never promises dates beyond the ETA range, never gives advice outside the Rule Book; anything else becomes an escalation on the Today board.
- Voice: ElevenLabs web conversation with a custom LLM pointing at PF Desk [verify Hindi/Marathi support]. Text works without voice minutes.

### F7 — Rule Book
Editable entries: `id`, `title`, `body`, `applies_to` (claim types / cycle step), `source` (circular number, URL, or "consultant practice"), `last_verified_by`, `last_verified_at`. Seed with entries your dad dictates on Day 1. Hybrid search (keyword + vector) because form numbers and terms like "10C", "Form 31", "EDLI" need exact keyword matching.

### F8 — Import
Upload `.xlsx`/`.csv` of employees and claims; column-mapping screen; preview; PII handling per Section 6 on import (full Aadhaar dropped immediately, last 4 kept).

### F9 — Local mode
`pnpm local` starts the app with Ollama models and a local Postgres (Docker) on your dad's laptop. Real data lives only there. Same UI.

---
## 5. Rule Book seed (every line: [verify with dad] and against current EPFO circulars)

These are starting points from general knowledge, **not** facts to ship. Your dad confirms or corrects each one on Day 1, and each entry stores its source.

| Topic | Starting point to verify |
| --- | --- |
| Contribution split | Employee 12% of basic + DA; employer 12% split into pension (8.33%, on wages capped at the ceiling) and PF (the rest) |
| Wage ceiling | ₹15,000 per month for pension contribution and mandatory coverage |
| EDLI | Employer pays about 0.5% of wages up to the ceiling |
| Admin charges | About 0.5% of wages with a monthly minimum |
| Monthly return and payment due | 15th of the following month; late payment attracts interest and damages |
| Common claim forms | Form 19 (final PF settlement), Form 10C (pension withdrawal benefit or scheme certificate), Form 31 (advance / partial withdrawal), Form 13 (transfer), Form 10D (monthly pension), Form 5IF (EDLI death claim) |
| Final settlement waiting period | A waiting period after leaving employment applies; **check the current rule**, it may have changed recently |
| Partial withdrawal | Purpose categories, minimum service and limits; EPFO has simplified these recently, **check the current rule** |
| Common rejection causes | Name / father's name / DOB mismatch across UAN, Aadhaar and bank; bank not verified; KYC not approved by employer; Aadhaar not linked; exit date not marked; unclear cheque or passbook image; ineligible service period; duplicate claim |

Add every rule your dad uses in practice, even unofficial ones ("this regional office always rejects X unless Y"), marked as `source: consultant practice`.

---

## 6. Privacy and compliance design

This is the heart of the "why open innovation matters" section. Build it first, not last.

1. **Two modes.**
   - **Local mode (real data):** runs on the consultant's laptop. Gemma and the fine-tuned decoder run via Ollama. Postgres runs locally. Nothing leaves the machine except optional voice for the helpline (see 6.5).
   - **Cloud demo (synthetic data only):** deployed on Render at `pfdesk.tech`. Uses a free hosted Gemma endpoint. A banner says "Demo data only".
2. **Never store full Aadhaar.** On import, full Aadhaar numbers are dropped immediately; only the last 4 digits and an "Aadhaar linked: yes/no" flag are kept. No Aadhaar images are stored. [verify the legal position on storing Aadhaar with dad and current rules]
3. **PII tokenizer before every model call.** Names, UAN, PAN, bank account numbers, phone numbers and amounts are replaced with tokens (`[NAME_1]`, `[UAN_1]`, `[ACC_1]`) before text goes to any model, and restored only in the final UI. Unit-tested with a corpus of Indian name and ID formats.
4. **De-identified features for TabPFN.** The TabPFN API (TabPFN-3.5 via platform.priorlabs.ai) only ever receives numeric/categorical features such as claim type, service months, match scores and flags. No names, IDs or amounts. In local mode, the open-weight TabPFN package can run fully offline instead [verify which versions run locally].
5. **Helpline voice.** Voice goes through ElevenLabs (a hosted service). So the agent never speaks or hears identifiers: employees are authenticated by their private link, the agent refers to "your claim", and transcripts are stored redacted. Text mode needs no third party at all.
6. **Access control.** Consultant login (passcode or magic link); employees only see their own claims via signed links; links expire; every access logged.
7. **India DPDP Act 2023.** Collect only what's needed, state the purpose, allow deletion on request, keep an access log [verify current rules and timelines].
8. **Disclaimers.** "PF Desk helps consultants prepare and check. It does not file with EPFO, and it is not legal or financial advice. Rules change: always verify with the latest EPFO circulars."

---

## 7. Architecture

```
                   CONSULTANT (your dad)                    EMPLOYEE
                   web app: Today board, Pre-check,         private help link
                   Decoder, Cycle, Rule Book                (text / voice, hi/mr/en)
                           │                                       │
┌──────────────────────────▼───────────────────────────────────────▼──────────┐
│ apps/web  Next.js (TypeScript, Tailwind)                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ apps/api  Hono + Mastra agent                                                │
│   PII tokenizer → tools: precheck · predictRisk · predictEta · decode        │
│                          · searchRules · getClaims · draftMessage · escalate │
│   custom-LLM endpoint for ElevenLabs voice                                   │
└──────┬───────────────┬─────────────────┬──────────────────┬─────────────────┘
       │               │                 │                  │
┌──────▼──────┐ ┌──────▼───────┐ ┌───────▼────────┐ ┌───────▼────────┐
│ Gemma       │ │ Decoder      │ │ TabPFN-3.5 API │ │ Tiger Data     │
│ local:      │ │ Tinker LoRA  │ │ (de-identified │ │ Postgres +     │
│  Ollama     │ │ on a small   │ │  features) or  │ │ pgvector +     │
│ demo: free  │ │ open model,  │ │ local TabPFN   │ │ keyword search │
│  hosted     │ │ via Ollama   │ │                │ │                │
└─────────────┘ └──────────────┘ └────────────────┘ └────────────────┘
       Temporal worker: monthly cycle + claim follow-up workflows
       Sentry: traces for every model call, tool call and workflow step
```

### 7.1 Deployment modes
| | Local mode (real use) | Cloud demo (judges) |
| --- | --- | --- |
| Where | Dad's laptop | Render (promo credits) at `pfdesk.tech` |
| Data | Real, anonymised where possible | Synthetic only |
| Gemma | Ollama (small Gemma that fits RAM) | Free hosted Gemma (Google AI Studio free tier [verify]) |
| Decoder | Tinker LoRA served via Ollama/llama.cpp | Same model on the Render instance if it fits, else Gemma few-shot fallback |
| Database | Postgres in Docker | Tiger Cloud free tier/trial [verify]; fallback Neon/Supabase free |
| Temporal | `temporal server start-dev` | Temporal Cloud trial [verify] or dev server on a Render service with a persistent disk (promo credits) [verify] |

---

## 8. Models (all open)

| Job | Model | Where | Notes |
| --- | --- | --- | --- |
| Explanations, messages, helpline | Gemma (latest available [verify]; a small variant for laptops, larger hosted for the demo) | Ollama / free hosted | Hindi and Marathi quality must be checked by your dad [verify] |
| Rejection Decoder | Small open model fine-tuned with **Tinker** (Gemma if Tinker supports it [verify], else a supported Qwen/Llama) | Ollama/llama.cpp after export [verify export path] | Section 15 |
| Rejection risk + settlement ETA | **TabPFN-3.5** (free non-commercial API key) or open TabPFN locally | API / local | Section 14 |
| Rule Book embeddings | Open embedding model (e.g. `nomic-embed-text` via Ollama, or a Gemma embedding model [verify]) | Ollama | 768-dim assumed |
| Speech (helpline voice) | ElevenLabs STT/TTS | Hosted | Optional; text mode needs none |

**Context-first agent:** free hosted and small local models differ in tool-calling reliability. The API gathers context in code (claim facts, ETA, Rule Book hits), then asks the model only to write; a separate structured call extracts intents. Tools via Mastra are an upgrade, not a dependency.

---

## 9. Partner map (submit only what you genuinely built)

| Partner | Prize | Use in PF Desk | Status | Cost |
| --- | --- | --- | --- | --- |
| **Gemma** | $200 | All language work; runs locally for real data | Core | Free |
| **TabPFN (Prior Labs)** | $200 | Rejection risk (classification) + settlement ETA (regression) inside the agent; via API or MCP server [verify MCP] | Core | Free non-commercial key |
| **Tinker** | $200 | Fine-tune the Rejection Decoder; baseline vs tuned | Core | **Promo credits** |
| **Render** | $200 | Hosts web, API and Temporal worker for the demo | Core | **Promo credits** |
| **.tech Domains** | $100 | Live at `pfdesk.tech` | Core | **Promo** (first year free; disable auto-renew) |
| **Temporal** | $100 | Monthly cycle per employer + claim follow-up; survives restarts | Core | Free (dev server / trial) |
| **Tiger Data** | $100 | Postgres + pgvector, hybrid keyword + vector search over the Rule Book | Core if free tier works | Free tier/trial [verify] |
| **ElevenLabs** | $100 | Hindi/Marathi voice helpline | Should | Free plan minutes |
| **Mastra** | $100 | Agent with permissioned tools, PII middleware, memory | Core | Free (open source) |
| **Sentry** | $100 | Agent tracing: latency, tokens, failures, debugging story | Process | Free plan |
| **Entire** | $100 | Agent sessions in the write-up | Process | Free [verify] |
| **GitHub Copilot** | $100 | PR review, Actions CI, test generation | Process | Free tier [verify] |
| **SerpApi** | $100 | Rule-change radar (F10) | Nice | Free plan |
| **Backboard** | $100 | Compare open models on the **synthetic** decoder eval set through one API key (F11) | Nice | **Promo credits** |
| DigitalOcean, Arduino, MongoDB | — | Not used | — | — |

**Claim at hacktoberfest.com/my/promos on Day 1:** Tinker, Render, Backboard, .tech domain. If a promo needs a card, skip it and use the fallback.

**Hosting choice:** Render with promo credits is the default because it's free for you **and** a $200 category. If credits don't cover a worker, put the web app on **Vercel's free Hobby plan** [verify non-commercial terms] and run the worker locally.

---
## 10. Data model

### 10.1 Repository structure
```
pfdesk/
├── apps/
│   ├── web/                  Next.js: Today, Employers, Employees, Claims, Pre-check, Decoder, Cycle, Rule Book, Help link page
│   └── api/                  Hono server, Mastra agent, PII tokenizer, custom-LLM endpoint, Temporal worker entry
├── packages/
│   ├── rules/                Deterministic checks (name match, DOB, IFSC, eligibility) driven by Rule Book config
│   ├── pii/                  Tokenizer/redactor + tests (Indian names, UAN, PAN, IFSC, account, phone, Aadhaar)
│   ├── llm/                  One OpenAI-compatible client (Ollama / hosted Gemma / decoder)
│   ├── agent/                Mastra agent, prompts, context builders, intent extraction
│   ├── db/                   SQL migrations, queries, hybrid search
│   └── shared/               zod schemas and types
├── workflows/                Temporal: MonthlyCycleWorkflow, ClaimFollowUpWorkflow
├── ml/
│   ├── tabpfn/               build_features.py, train_eval.py, serve.py (FastAPI) or API client
│   ├── decoder/              label_tool/, build_dataset.py, tinker_train.py, eval.py, export.md
│   └── synthetic/            make_synthetic.py (Faker en_IN) for demo data
├── evaluation/               Results tables (markdown/CSV), committed
├── tests/
├── docs/                     interview-notes.md (anonymised), screenshots, architecture.png
├── docker-compose.yml        Local mode: Postgres + pgvector, Temporal dev server
├── render.yaml
├── .env.example
└── README.md
```

### 10.2 Schema (Postgres + pgvector)
```sql
create extension if not exists vector;

create table employers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  establishment_code text,             -- store as given; not secret but treat as internal
  contact_name text, contact_phone text,
  cycle_day int not null default 1,     -- day to request salary data
  due_day int not null default 15,      -- [verify with dad]
  created_at timestamptz default now()
);

create table employees (
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

create table claims (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  form text not null,                    -- '19','10C','31','13','10D','5IF', ...
  purpose text,                          -- for advances
  status text not null default 'draft'
    check (status in ('draft','checked','submitted','under_process','settled','rejected','resubmitted','closed')),
  submitted_at date, settled_at date, rejected_at date,
  rejection_remark text,
  decoded jsonb,                         -- Rejection Decoder output
  risk_pct real, risk_model text,
  eta_days real, eta_low real, eta_high real, eta_model text,
  created_at timestamptz default now()
);

create table precheck_results (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  issues jsonb not null,                 -- [{code, severity, field, message, fix_step_id, rule_id}]
  features jsonb not null,               -- de-identified features sent to TabPFN
  created_at timestamptz default now(),
  confirmed_by_consultant boolean        -- for "issues caught" metric
);

create table history_claims (           -- anonymised past claims for TabPFN training
  id serial primary key,
  form text, service_months int, age_band text, employer_size_band text,
  name_match real, father_match real, dob_match boolean, bank_verified boolean,
  kyc_approved boolean, aadhaar_linked boolean, exit_marked boolean,
  months_since_exit int, submit_month int, office_code text,
  outcome text check (outcome in ('settled','rejected')),
  days_to_outcome int,
  rejection_category text
);

create table salary_uploads (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade,
  wage_month date not null,
  rows jsonb not null,                   -- normalised rows (no Aadhaar)
  validation jsonb,                      -- totals, anomalies, flags
  status text default 'received' check (status in ('received','validated','paid','archived')),
  created_at timestamptz default now()
);

create table rules (
  id text primary key,                   -- e.g. 'R-NAME-MATCH'
  title text not null,
  body text not null,
  applies_to text[] not null default '{}',
  source text not null,
  last_verified_by text, last_verified_at date,
  embedding vector(768),
  body_tsv tsvector generated always as (to_tsvector('simple', title || ' ' || body)) stored
);
create index on rules using gin (body_tsv);
create index on rules using hnsw (embedding vector_cosine_ops);
-- On Tiger Cloud, optionally a BM25 index via pg_textsearch [verify]

create table help_links (
  token_hash text primary key,
  employee_id uuid references employees(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table help_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  channel text check (channel in ('text','voice')),
  transcript_redacted jsonb,
  resolved boolean, escalated boolean,
  created_at timestamptz default now()
);

create table tasks (                     -- Today board items
  id uuid primary key default gen_random_uuid(),
  kind text not null, ref_id uuid, title text not null,
  due_at timestamptz, done boolean default false,
  created_at timestamptz default now()
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  kind text, model text, tokens_in int, tokens_out int, latency_ms int, trace_id text,
  created_at timestamptz default now()
);

create table access_log (
  id bigserial primary key, actor text, action text, ref_id uuid, at timestamptz default now()
);
```
Use the `'simple'` text configuration so form numbers ("10C", "31") and transliterated words aren't stemmed away. Hybrid search uses reciprocal rank fusion of keyword rank and vector rank (k = 60).

### 10.3 Synthetic dataset (public demo, screenshots, benchmarks you publish)
`ml/synthetic/make_synthetic.py` with Faker `en_IN`: 8 employers, 300 employees, 400 claims with realistic error patterns planted at rates your dad estimates (e.g. 12% name mismatch, 6% bank not verified). Names in Latin script with common transliteration variants. Never derived from real people.

---

## 11. API

| Method & path | Purpose |
| --- | --- |
| `POST /auth/login` | Consultant passcode login (hackathon); magic link later |
| `GET/POST /v1/employers`, `GET/PATCH /v1/employers/:id` | Clients |
| `POST /v1/import` (multipart) | Excel/CSV import with column mapping; drops full Aadhaar |
| `GET/POST /v1/employees`, `GET/PATCH /v1/employees/:id` | Members |
| `POST /v1/claims` · `PATCH /v1/claims/:id` | Create claim; update status (signals Temporal) |
| `POST /v1/claims/:id/precheck` | Run checks + TabPFN risk + messages |
| `POST /v1/claims/:id/decode` `{remark}` | Rejection Decoder |
| `GET /v1/claims/:id/eta` | Settlement ETA |
| `GET /v1/today` | Today board |
| `POST /v1/employers/:id/salary` (multipart) | Monthly upload → validation (signals cycle) |
| `POST /v1/employers/:id/cycle/paid` | Mark paid |
| `GET /v1/rules/search?q=` · `GET/POST/PATCH /v1/rules` | Rule Book |
| `POST /v1/help-links` `{employee_id}` | Create private help link |
| `GET /help/:token` (web page) · `POST /v1/help/:token/message` | Employee text helpline |
| `POST /v1/voice/llm/chat/completions` | Custom-LLM endpoint for ElevenLabs (OpenAI-compatible, streaming) [verify format] |
| `POST /v1/voice/webhooks/post-call` | Store redacted transcript, outcome |
| `GET /health` | Status of DB, models, Temporal |

---

## 12. Agent (Mastra)

**Tools** (every tool input/output passes through the PII tokenizer; tools return masked data only):
`getClaim`, `runPrecheck`, `predictRisk` (TabPFN), `predictEta` (TabPFN), `decodeRemark` (fine-tuned decoder), `searchRules`, `draftMessage(lang)`, `createTask`, `escalate`.

**Permissions:** consultant context may call everything; helpline context may call only `getClaim` (own claims), `predictEta`, `searchRules`, `escalate`. No tool can submit anything to EPFO.

**Consultant assistant system prompt (start):**
```
You help a Provident Fund consultant prepare and check EPF claims and monthly filings.
Use ONLY the facts and Rule Book entries provided. Cite the rule id for every rule you state.
Never invent rates, deadlines, form requirements or eligibility rules. If the Rule Book doesn't cover it, say so.
Identifiers appear as tokens like [NAME_1] or [UAN_1]; keep them exactly as given.
Be brief and practical: what is wrong, why it matters, exactly how to fix it.
```

**Helpline system prompt (start):**
```
You answer one employee's questions about their own PF claim, in their language (Hindi, Marathi or English).
Use only the claim facts, the settlement estimate and the Rule Book entries provided.
Give dates only as the estimate range provided; say clearly it is an estimate.
Never ask for or repeat Aadhaar, PAN, bank or UAN numbers.
If the question is outside these facts, or the person is upset or the claim was rejected, say the consultant will call them, and escalate.
Keep answers to 2-3 short sentences. Be warm and respectful.
```

**Messages to employees** are drafted for the consultant to review and send from his own WhatsApp. PF Desk never messages employees directly in the MVP.

---

## 13. Temporal workflows

**`MonthlyCycleWorkflow(employerId, wageMonth)`** — one per employer per month:
```
await sleep(until cycle_day 10:00 IST)
await activity.createTask("Request salary sheet", draft WhatsApp text)
upload = await condition(signal 'salaryUploaded', timeout until due_day - 5)
if !upload: createTask("Chase salary sheet", high); wait again until due_day - 2
validation = await activity.validateSalary(uploadId)     // Rule Book checks + anomaly flags
await activity.createTask("Review validation", validation summary)
paid = await condition(signal 'paid', timeout until due_day 10:00)
if !paid: createTask("Payment due today", urgent); await condition(signal 'paid', timeout 7 days)
await activity.archive(employerId, wageMonth)
```

**`ClaimFollowUpWorkflow(claimId)`** — starts when a claim is marked submitted:
```
loop:
  await condition(signal 'statusChanged', timeout = eta_high days)
  if timeout: createTask("Claim overdue vs estimate — check portal")
  if status == 'rejected': decoded = activity.decodeRemark(); createTask("Fix and resubmit", decoded); draft employee message
  if status in ('settled','closed'): activity.recordOutcome()  // becomes new TabPFN training data
     return
```
Signals come from the consultant tapping status in the UI (no portal automation). Activities retry 3 times with backoff. **Demo:** kill the worker mid-cycle, restart, show it resume with no duplicate tasks.

---

## 14. TabPFN tasks

1. **Rejection risk (classification).** Rows = your dad's past claims, anonymised into `history_claims` (Day 1–2 data entry from his records; aim for 150+ rows, more is better). Label = settled vs rejected. Features = the de-identified columns in `history_claims`. If real history is too small (< ~80 rows), say so honestly, still show the pipeline, and use the synthetic set only for the public demo.
2. **Settlement ETA (regression).** Same rows, target = `days_to_outcome` for settled claims; report MAE and a prediction interval (TabPFN gives quantiles or use its distribution output [verify]).
3. **Inside the agent:** `predictRisk` and `predictEta` are agent tools; Prior Labs favours this. Optionally connect through the TabPFN MCP server [verify].
4. **Baselines:** majority class / historical rejection rate per form; logistic regression; default gradient boosting. Time-ordered split (train older, test newer). Metrics: ROC-AUC, Brier, precision@high-risk; ETA MAE.
5. **Every newly settled or rejected claim** is appended to training data (the product gets better with use; say this in the post).

---

## 15. Tinker task: the Rejection Decoder

**Why fine-tune:** EPFO remarks are terse, inconsistent and full of abbreviations; a generic model guesses. A small model trained on real remarks labelled by a consultant should beat a much larger general model, faster and cheaper.

**Categories (start; your dad edits):** `name_mismatch`, `father_name_mismatch`, `dob_mismatch`, `bank_details_invalid`, `bank_not_verified`, `cheque_image_unclear`, `kyc_not_approved`, `aadhaar_not_linked`, `exit_date_missing`, `service_ineligible`, `waiting_period`, `purpose_ineligible`, `duplicate_claim`, `signature_or_photo`, `other`.

**Dataset:**
1. Collect real remarks from your dad's records (no personal data in remarks; strip any if present). Aim for 150–400.
2. Label with a tiny local web tool (`ml/decoder/label_tool`): your dad picks category and fix steps; 1–2 hours.
3. Augment with paraphrases (abbreviations, upper/lower case, typos) generated by Gemma locally, re-checked by you.
4. Split: 70% train, 30% test; keep 25 hard cases in test.
5. Output target: strict JSON (`category`, `fields_involved`, `fix_step_ids`, short messages in hi/mr/en).

**Training:** Tinker LoRA on a small supported open model (Gemma if supported [verify], else Qwen/Llama small) using promo credits. Download weights, convert for Ollama/llama.cpp [verify export path].

**Evaluation (same test set):** base small model zero-shot · Gemma (larger) few-shot · fine-tuned. Report category macro-F1, JSON validity, message quality rated by your dad (1–5), p50 latency on the laptop, cost per 1,000 remarks.

---

## 16. Helpline voice (ElevenLabs)

1. Create an ElevenLabs Agent; pick a voice that handles Hindi (and Marathi if supported [verify]); LLM = **Custom LLM** pointing to `/v1/voice/llm/chat/completions` with a secret header [verify setup].
2. The help page (`/help/:token`) starts a web conversation (ElevenLabs JS/React SDK [verify]) with the employee's token as a dynamic variable; no phone numbers needed.
3. The custom-LLM endpoint builds context from the token (own claims, ETA, Rule Book hits), runs the helpline prompt on Gemma, streams back.
4. Free minutes are limited: build and test in **text mode**; enable voice for real employees and the demo.

---

## 17. Free stack and hosting

| Need | Choice | Cost |
| --- | --- | --- |
| Web + API + worker (demo) | **Render** (promo credits) via `render.yaml`; custom domain `pfdesk.tech` | Free via promo |
| Fallback web hosting | **Vercel Hobby** for `apps/web` [verify terms]; API on Render free web service | Free |
| Domain | **.tech** promo, first year free | Free (disable auto-renew) |
| Database | **Tiger Cloud** free tier/trial [verify]; fallback Neon or Supabase free | Free |
| Temporal | Dev server locally; Temporal Cloud trial if no card [verify]; or dev server on Render with persistent disk via credits [verify] | Free |
| Gemma (local) | **Ollama** | Free |
| Gemma (demo) | Google AI Studio free tier [verify Gemma availability] or OpenRouter free [verify] | Free |
| Fine-tune | **Tinker** promo credits; fallback Unsloth on Kaggle free GPU | Free |
| TabPFN | TabPFN-3.5 free non-commercial key; local open package for offline mode | Free |
| Voice | ElevenLabs free plan | Free |
| Observability | Sentry free plan | Free |
| CI | GitHub Actions (public repo) | Free |

`render.yaml` (adjust plan names to what the credits cover [verify]):
```yaml
services:
  - type: web
    name: pfdesk-web
    runtime: node
    buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm --filter web build
    startCommand: pnpm --filter web start
    envVars:
      - key: NEXT_PUBLIC_API_URL
        sync: false
  - type: web
    name: pfdesk-api
    runtime: node
    buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm --filter api build
    startCommand: pnpm --filter api start
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: DEMO_MODE
        value: "true"
  - type: worker
    name: pfdesk-worker
    runtime: node
    buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm --filter api build
    startCommand: pnpm --filter api worker
```

### 17.1 Environment variables (`.env.example`)
```
DEMO_MODE=true                         # true = synthetic data only, banner on
DATABASE_URL=
APP_ENCRYPTION_KEY=                    # for UAN, bank account, phone
CONSULTANT_PASSCODE=
HELP_LINK_SECRET=

LLM_BASE_URL=http://localhost:11434/v1 # Ollama locally; hosted Gemma endpoint in demo [verify]
LLM_API_KEY=
LLM_MODEL=gemma...                     # exact tag from Ollama / provider
DECODER_BASE_URL=http://localhost:11434/v1
DECODER_MODEL=pfdesk-decoder
EMBED_MODEL=nomic-embed-text

TABPFN_MODE=api                        # api | local
TABPFN_API_KEY=                        # platform.priorlabs.ai, non-commercial

TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_API_KEY=

ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
VOICE_SHARED_SECRET=

SENTRY_DSN_API=
SENTRY_DSN_WEB=
SERPAPI_KEY=                           # optional
BACKBOARD_API_KEY=                     # optional
NEXT_PUBLIC_API_URL=
```

---
## 18. UX notes (it must be usable by your dad on day one)

- **Today board is the home screen.** Five sections, each item one tap to act.
- **Big, plain screens.** Large text, high contrast, English labels with Hindi/Marathi toggle; works on a laptop and a phone browser.
- **Pre-check result reads like a colleague:** "2 problems. 1) Father's name differs: 'Ramesh K Patil' (UAN) vs 'Ramesh Krishna Patil' (bank). Ask for an updated bank record or correct via joint declaration [rule R-FATHER-NAME]. 2) …" with a **Copy WhatsApp message** button.
- **Every number and rule shows its source** (rule id, model version).
- **Demo banner** when `DEMO_MODE=true`.
- Show loading states for model calls; never a blank screen.

---

## 19. Build plan (Tue Oct 13 → Sun Oct 18)

Each phase: tasks → prompt for your coding agent → acceptance checks. Keep scope ruthless: Must features first.

### Phase 0 — Tuesday evening: data, promos, scaffold
- [ ] **Interview your dad** (Section 2.3, 30 min). Write `docs/interview-notes.md` (no personal data).
- [ ] With him, list 15–25 Rule Book entries and the top rejection causes; ask him to start gathering past claims and rejection remarks.
- [ ] Claim promos at hacktoberfest.com/my/promos (Tinker, Render, Backboard, .tech); register `pfdesk.tech` if available and **turn off auto-renew**; get a TabPFN API key at platform.priorlabs.ai.
- [ ] Go through Section 23 (verify list).

> **Prompt:** "Scaffold the pnpm monorepo in Section 10.1 of PFDESK_PRD.md: Next.js + Tailwind web app, Hono API, packages, docker-compose with Postgres+pgvector and the Temporal dev server, .env.example from Section 17.1, CI running lint, typecheck and tests. Then implement the Section 10.2 migrations and Section 10.3 synthetic data generator."

**Done when:** `docker compose up` + `pnpm dev` runs locally; synthetic data loads; CI green.

### Phase 1 — Wednesday: PII layer, import, Pre-check rules, Rule Book
> **Prompt:** "Implement packages/pii (tokenizer/redactor with tests for Indian names, UAN, PAN, IFSC, account numbers, phones, Aadhaar) and make every LLM call go through it. Implement the Excel/CSV import (F8) that drops full Aadhaar and keeps last 4. Implement packages/rules for F1 checks driven by the rules table. Implement the Rule Book UI with hybrid search (Section 10.2). Build the Today board and Pre-check screens per Section 18."

**Done when:** all planted errors in 20 synthetic cases are caught; Rule Book search finds 'Form 10C' by keyword and 'pension withdrawal' by meaning; no full Aadhaar anywhere in the DB.

### Phase 2 — Wednesday night / Thursday: TabPFN + Gemma explanations
- [ ] Your dad's past claims entered (anonymised) into `history_claims`.
> **Prompt:** "Implement ml/tabpfn per Section 14 with the three baselines and time-ordered split; write results to evaluation/tabpfn.md. Expose predictRisk and predictEta to the API. Add Gemma explanations and hi/mr/en WhatsApp drafts to Pre-check using the context-first pattern in Section 8 and the consultant prompt in Section 12."

**Done when:** Pre-check shows risk %, ETA and a correct Hindi message your dad approves.

### Phase 3 — Thursday: Rejection Decoder with Tinker
- [ ] Your dad labels remarks with the label tool (1–2 hours).
> **Prompt:** "Implement ml/decoder per Section 15: label tool, dataset builder with augmentation, Tinker LoRA training script, evaluation against two baselines writing evaluation/decoder.md, and the export to Ollama. Wire POST /v1/claims/:id/decode with a Gemma few-shot fallback."

**Done when:** the tuned decoder beats both baselines on macro-F1 (or you report honestly that it didn't, and why).

### Phase 4 — Friday: Temporal, helpline, deploy
> **Prompt:** "Implement MonthlyCycleWorkflow and ClaimFollowUpWorkflow per Section 13 with signals from the UI and retries. Implement help links and the text helpline (F6) with the helpline prompt and permissions. Add the ElevenLabs custom-LLM endpoint and voice on the help page (Section 16). Add Sentry tracing to every model call, tool and activity. Deploy the demo with render.yaml on Render, point pfdesk.tech at it, DEMO_MODE=true."

**Done when:** a synthetic employer's cycle runs end to end; killing the worker mid-cycle and restarting resumes without duplicate tasks; a Hindi helpline question gets a grounded answer by text and voice; `https://pfdesk.tech` works.

### Phase 5 — Friday evening & Saturday: real use
- [ ] **Local mode on your dad's laptop** (`pnpm local`): he uses it on real claims for at least a day. Sit with him for the first hour; note every confusion and fix the top 3.
- [ ] Log metrics (Section 3) from real use.
- [ ] Show it to 2 other consultants (Section 2.4); record their answers.

### Phase 6 — Saturday: benchmarks, video
- [ ] Run Section 20; commit tables. Capture Sentry traces.
- [ ] Record the demo (Section 21) using synthetic data on screen; film your dad (with his permission) using it, screen showing only synthetic or blurred data.

### Phase 7 — Sunday: DEV post + submit
- [ ] Write the post (Section 22) with real numbers; embed the DevRelay/Entire agent session; list only partners you actually used.
- [ ] Submit by Sunday night IST (official cutoff: Mon Oct 19, ~12:29 PM IST).

**If time runs short, cut in this order:** F10, F11, voice (keep text helpline), MonthlyCycle anomaly detection (keep reminders), local-mode polish.

---

## 20. Benchmarks and evidence

| # | What | Metric | Baseline | Target |
| --- | --- | --- | --- | --- |
| 1 | Rejection risk (TabPFN) | ROC-AUC, Brier, precision@high-risk | Historical rate per form; logistic regression; gradient boosting | Beat best baseline; report honestly if data is small |
| 2 | Settlement ETA (TabPFN) | MAE in days, interval coverage | Median days per form | Lower MAE than median baseline |
| 3 | Rejection Decoder (Tinker) | Macro-F1, JSON validity, dad's 1–5 message rating, latency, cost/1k | Base small model; larger Gemma few-shot | Tuned ≥ larger Gemma on F1, much faster |
| 4 | Pre-check rules | Recall on planted errors; false alarms per 100 claims | — | 100% recall on hard blockers |
| 5 | PII safety | Leaks found by a red-team test set of 200 strings | — | 0 leaks |
| 6 | Hybrid search | Recall@5 on 30 Rule Book questions | Keyword only; vector only | Hybrid best |
| 7 | Helpline | Share of test questions answered correctly without escalation; wrong-answer rate | — | Wrong answers ≈ 0; escalate when unsure |
| 8 | Durability | Correct resumes out of 20 forced worker kills | — | 20/20 |
| 9 | Real use | Claims checked, issues caught (confirmed), estimated rejections avoided, help questions handled | Dad's previous month | Real numbers, even if small |
| 10 | Willingness to pay | Consultant answers | — | Quote them verbatim |

---

## 21. Demo video (3 minutes)

| Time | Shot | Audio |
| --- | --- | --- |
| 0:00–0:20 | Your dad's desk: files, phone ringing (staged or real, no personal data visible) | "My dad is a PF consultant. When one letter in a father's name doesn't match, a worker waits weeks longer for their own money, and my dad gets the calls." |
| 0:20–0:40 | Today board | "So I built him PF Desk: a private back office that runs on open models, so Aadhaar and bank data never go to an AI company." |
| 0:40–1:10 | **Wow:** enter a synthetic claim → father's-name mismatch flagged → 78% rejection risk → Hindi WhatsApp message copied | "It caught what EPFO would have rejected, before submission." |
| 1:10–1:30 | Paste a real-style rejection remark → decoded with fix steps | "EPFO remarks are cryptic. A small model fine-tuned with Tinker on my dad's labelled remarks decodes them." Show baseline vs tuned numbers. |
| 1:30–1:55 | Employee help link on a phone; asks in Hindi by voice; answer with ETA | "Employees ask in Hindi or Marathi. TabPFN estimates settlement from past claims." |
| 1:55–2:15 | Kill the worker, restart, the monthly cycle resumes | "The monthly cycle for every client survives crashes and restarts." |
| 2:15–2:35 | Sentry trace; architecture; local mode on the laptop | "Locally, everything runs on his laptop. The demo runs on Render at pfdesk.tech with fake data." |
| 2:35–3:00 | Your dad using it; his quote; consultant pricing quotes | "He used it on [N] real claims this week. Two other consultants said they'd pay [₹X]." |

---

## 22. DEV post outline (Side Hustle)

**Title idea:** *"My dad gets 20 calls a day asking 'PF kab aayega?'. I built him a back office that runs on open models."* (use real numbers)

1. **What I Built** — the problem through one real (anonymised) story; who pays and the pricing hypothesis; what PF Desk does.
2. **Demo** — `pfdesk.tech` (synthetic data), video.
3. **Code** — GitHub link, license.
4. **How I Built It** — privacy-first architecture; Pre-check rules; TabPFN risk and ETA with baselines; Tinker decoder before/after; Temporal cycle and kill-resume; helpline in Hindi/Marathi; Sentry traces and one bug you found through them.
5. **Why Does Open Innovation Matter?** — Aadhaar, bank and salary data never leave the consultant; runs on a laptop with no internet; cost per claim near zero so a ₹499/month product works; fine-tuned for EPFO's own language that general APIs handle poorly; no lock-in to someone else's pricing.
6. **My first user** — your dad's week: numbers, what he liked, what confused him, what he asked for next; the other consultants' answers on paying.
7. **My Agent Session** — DevRelay/Entire embed or link; Copilot review examples.
8. **Prize Categories** — only what you genuinely used.

Be explicit about limits: small training data, rules need constant verification, not legal advice, TabPFN non-commercial license would need a commercial license for a paid product.

---

## 23. Risks and how we handle them

| Risk | Handling |
| --- | --- |
| Too little past claim data for TabPFN | Report honestly; still show the pipeline; ETA regression may work with fewer rows; every new outcome becomes training data |
| Wrong PF rule in output | Rules only from the Rule Book with sources; dad verifies; model can't state rules outside it |
| Personal data leak | PII tokenizer + tests; local mode for real data; synthetic data everywhere public |
| "Just a CRUD app with an LLM" accusation | Show TabPFN and Tinker benchmark tables, Sentry traces of the agent, real usage numbers |
| Hindi/Marathi quality | Dad rates messages; fall back to English + Hindi only if Marathi is weak |
| Promo credits insufficient | Fallbacks in Section 17; run worker locally |
| Temporal hosting | Dev server locally for real use; demo kill-resume recorded locally |
| Not enough time | Cut order in Section 19 |

---

## 24. Verify list (Tuesday night)

- [ ] Challenge rules: new project requirement, deadline in IST, template, DevRelay embed
- [ ] Promos at hacktoberfest.com/my/promos: Tinker, Render, Backboard credits; .tech domain availability, renewal setting
- [ ] TabPFN-3.5 API sign-up, non-commercial license terms, rate limits, MCP server; which TabPFN version runs locally
- [ ] Tinker supported models (is Gemma available?), LoRA export and conversion to Ollama/llama.cpp
- [ ] Gemma: latest version; sizes that run in 8–16 GB RAM via Ollama; free hosted access (AI Studio/OpenRouter) and limits
- [ ] Hindi and Marathi quality of the chosen Gemma size
- [ ] ElevenLabs free plan minutes; Hindi/Marathi STT and TTS; custom-LLM request format; web SDK
- [ ] Tiger Cloud free tier/trial; pg_textsearch availability; else Neon/Supabase
- [ ] Temporal Cloud trial terms; Render persistent disk with credits
- [ ] Render: what promo credits cover (worker, disk); Blueprint fields for pnpm monorepos; custom domain setup
- [ ] Vercel Hobby terms (fallback)
- [ ] **With dad:** every Rule Book entry, contribution rates, due dates, claim forms, waiting periods, current partial-withdrawal rules, return file format, rejection categories
- [ ] Legal position on storing Aadhaar last-4 and documents; DPDP Act basics
