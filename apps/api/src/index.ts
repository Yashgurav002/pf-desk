import { capture } from './sentry.ts'; // first: initialises Sentry when SENTRY_DSN_API is set
import { Hono } from 'hono';
import type { Context } from 'hono';
import { serve } from '@hono/node-server';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import * as XLSX from 'xlsx';
import { query, migrate } from './db.ts';
import { enc, dec, sign, verify, newToken, hashToken, mask } from './crypto.ts';
import { chat } from './llm.ts';
import { searchRules } from './search.ts';
import { seedRules, seedDemo, embedMissingRules } from './seed.ts';
import { embed } from './llm.ts';
import { Pii } from './pii.ts';
import { runChecks, features } from './checks.ts';
import type { Issue, EmployeeFacts } from './checks.ts';
import { REMARKS } from './synthetic.ts';
import { labels, VOCAB } from './labels.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tabpfnRisk, tabpfnEta, ageBand, sizeBand } from './tabpfn.ts';
import type { FeatureRow } from './tabpfn.ts';
import { parseSalarySheet } from './salary.ts';
import { validateSalary } from './activities.ts';
import { startCycle, cycleUploaded, cyclePaid, cycleStatus, claimStatusChanged } from './temporal.ts';

const env = process.env;
const DEMO = env.DEMO_MODE === 'true';
const PASSCODE = env.CONSULTANT_PASSCODE || (DEMO ? 'demo' : '');
const PUBLIC_URL = env.PUBLIC_URL || 'http://localhost:3000';
const LANGS = { hi: 'Hindi (Devanagari script)', mr: 'Marathi (Devanagari script)', en: 'English' } as const;
type Lang = keyof typeof LANGS;
const CATEGORIES = Object.keys(VOCAB.categories); // ml/decoder/labels.json
const STATUSES = ['draft', 'checked', 'submitted', 'under_process', 'settled', 'rejected', 'resubmitted', 'closed'];
const CONSULTANT_PROMPT = `You help a Provident Fund consultant prepare and check EPF claims and monthly filings.
Use ONLY the facts and Rule Book entries provided. Cite the rule id for every rule you state.
Never invent rates, deadlines, form requirements or eligibility rules. If the Rule Book doesn't cover it, say so.
Identifiers appear as tokens like [NAME_1] or [UAN_1]; keep them exactly as given.
Be brief and practical: what is wrong, why it matters, exactly how to fix it.`;
const HELPLINE_PROMPT = `You answer one employee's questions about their own PF claim, in their language (Hindi, Marathi or English).
Use only the claim facts, the settlement estimate and the Rule Book entries provided.
Give dates only as the estimate range provided; say clearly it is an estimate.
Never ask for or repeat Aadhaar, PAN, bank or UAN numbers.
If the question is outside these facts, or the person is upset or the claim was rejected, say the consultant will call them, and escalate.
Keep answers to 2-3 short sentences. Be warm and respectful.
Reply as JSON: {"topic": "status" | "documents" | "other", "answer": string, "escalate": boolean}.
topic "status" = when will my money come / what is happening with my claim. "documents" = what document or correction is needed for my claim.
Anything else (loans, advances, other schemes, complaints, advice, EPFO offices or staff, rules not in the entries) is "other".`;
const CALLBACK = {
  hi: 'यह सवाल मैं यहाँ नहीं बता सकता। आपके PF सलाहकार जल्द ही आपको कॉल करेंगे।',
  mr: 'या प्रश्नाचे उत्तर मी येथे देऊ शकत नाही. तुमचे PF सल्लागार लवकरच तुम्हाला कॉल करतील.',
  en: "I can't answer that here. Your PF consultant will call you soon.",
};
// rejected claim: never let the model guess a date or reason; the consultant handles it
const REJECTED = {
  hi: 'आपके क्लेम में कुछ सुधार की ज़रूरत है, इसलिए अभी पैसे की तारीख नहीं बताई जा सकती। आपके PF सलाहकार जल्द ही आपको कॉल करके बताएंगे कि क्या करना है।',
  mr: 'तुमच्या क्लेममध्ये काही दुरुस्ती करावी लागेल, त्यामुळे आत्ता पैशाची तारीख सांगता येत नाही. तुमचे PF सल्लागार लवकरच कॉल करून पुढे काय करायचे ते सांगतील.',
  en: 'Your claim needs a correction, so there is no payment date yet. Your PF consultant will call you soon and tell you what to do.',
};
// gemma3:4b sometimes drifts into another script mid-sentence (Bengali, CJK…); retry once, then strip
const FOREIGN_SCRIPT = /[ঀ-෿฀-࿿぀-ヿ一-鿿가-힯؀-ۿ]/;

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + Math.round(n)); return x.toISOString().slice(0, 10); };
const log = (action: string, ref_id: string | null, actor = 'consultant') =>
  query('insert into access_log (actor, action, ref_id) values ($1,$2,$3)', [actor, action, ref_id]).catch(() => {});

const app = new Hono();
app.onError((err, c) => { console.error(err); capture(err); return c.json({ error: err.message }, 500); });

// ---------- auth ----------
const COOKIE = 'pfd';
app.post('/auth/login', async (c) => {
  const { passcode } = await c.req.json();
  if (!PASSCODE || passcode !== PASSCODE) return c.json({ error: 'Wrong passcode' }, 401);
  const exp = Date.now() + 7 * 864e5;
  setCookie(c, COOKIE, sign(`consultant:${exp}`), { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 7 * 86400 });
  return c.json({ ok: true });
});
app.post('/auth/logout', (c) => { deleteCookie(c, COOKIE, { path: '/' }); return c.json({ ok: true }); });
const authed = (c: Context) => {
  const p = verify(getCookie(c, COOKIE) ?? '');
  return !!p && Number(p.split(':')[1]) > Date.now();
};
app.get('/auth/me', (c) => (authed(c) ? c.json({ ok: true }) : c.json({ error: 'Login required' }, 401)));
let booting = true, bootError: string | null = null;
app.use('/v1/*', async (c, next) => {
  if (booting) return c.json({ error: bootError ? `Server failed to start: ${bootError}` : 'PF Desk is starting up (loading demo data). Please try again in a minute.' }, 503);
  // help pages use their own link token; the voice LLM endpoint checks VOICE_SHARED_SECRET itself
  if (c.req.path.startsWith('/v1/help/') || c.req.path.startsWith('/v1/voice/') || authed(c)) return next();
  return c.json({ error: 'Login required' }, 401);
});

app.get('/health', async (c) => {
  if (booting) return c.json({ ok: !bootError, starting: true, error: bootError }, bootError ? 500 : 200);
  const db = await query('select 1').then(() => true, () => false);
  const llm = await fetch(`${env.LLM_BASE_URL}/models`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false);
  return c.json({ ok: db, demo: DEMO, db, llm });
});

// ---------- shared queries ----------
const CLAIM_ROW = `select c.id, c.form, c.status, c.employee_id, e.name_uan employee_name, er.name employer_name,
  c.risk_pct, c.submitted_at, c.eta_high, c.rejection_remark,
  (select jsonb_array_length(p.issues) from precheck_results p where p.claim_id = c.id order by p.created_at desc limit 1)::int issue_count
  from claims c join employees e on e.id = c.employee_id join employers er on er.id = e.employer_id`;

async function getEmployee(id: string) {
  const [e] = await query('select e.*, er.name employer_name from employees e join employers er on er.id = e.employer_id where e.id = $1', [id]);
  return e;
}
const facts = (e: any): EmployeeFacts => ({ ...e, bank_account: dec(e.bank_account_enc) });
const maskedEmployee = (e: any) => {
  const { uan, bank_account_enc, phone_enc, ...rest } = e;
  return { ...rest, uan_masked: mask(dec(uan) ?? ''), account_masked: mask(dec(bank_account_enc) ?? ''), phone_masked: mask(dec(phone_enc) ?? '') };
};
const employeePii = (e: any) => {
  const pii = new Pii();
  for (const n of [e.name_uan, e.name_bank, e.name_aadhaar, e.father_name_uan, e.father_name_bank]) if (n) pii.add('NAME', n);
  const uan = dec(e.uan), acc = dec(e.bank_account_enc), phone = dec(e.phone_enc);
  if (uan) pii.add('UAN', uan);
  if (acc) pii.add('ACC', acc);
  if (phone) pii.add('PHONE', phone);
  return pii;
};

// TabPFN first (ml/tabpfn/serve.py); history baselines when the service is down or for fast bulk runs
async function predictRisk(form: string, f: Record<string, any>, row?: FeatureRow) {
  const t = row && (await tabpfnRisk(row));
  if (t) return t;
  const flags = [f.bank_verified ?? true, f.kyc_approved ?? true, f.aadhaar_linked ?? true, f.exit_marked ?? true, f.dob_match ?? true, (f.name_match ?? 1) < 0.85, (f.father_match ?? 1) < 0.85];
  const [m] = await query(`select count(*)::int n, avg((outcome = 'rejected')::int)::float rate from history_claims
    where form = $1 and bank_verified = $2 and kyc_approved = $3 and aadhaar_linked = $4 and exit_marked = $5 and dob_match = $6
    and (name_match < 0.85) = $7 and (father_match < 0.85) = $8`, [form, ...flags]);
  if (m.n >= 10) return { pct: m.rate, model: `history-match baseline (n=${m.n})` };
  const [b] = await query(`select count(*)::int n, avg((outcome = 'rejected')::int)::float rate from history_claims where form = $1`, [form]);
  return { pct: b.n ? b.rate : 0.1, model: `form-rate baseline (n=${b.n})` };
}
async function predictEta(form: string, row?: FeatureRow) {
  const t = row && (await tabpfnEta(row));
  if (t) return t;
  const [r] = await query(`select percentile_cont(0.5) within group (order by days_to_outcome)::float p50,
    percentile_cont(0.2) within group (order by days_to_outcome)::float p20,
    percentile_cont(0.8) within group (order by days_to_outcome)::float p80, count(*)::int n
    from history_claims where form = $1 and outcome = 'settled'`, [form]);
  if (!r?.n) return null;
  return { days: r.p50, low: r.p20, high: r.p80, model: `median-per-form baseline (n=${r.n})` };
}
const etaView = (c: any) => {
  if (c.eta_days == null) return null;
  const from = c.submitted_at ?? today();
  return { days: c.eta_days, low: c.eta_low, high: c.eta_high, model: c.eta_model, likely_date: addDays(from, c.eta_days), range: [addDays(from, c.eta_low), addDays(from, c.eta_high)] };
};
const precheckView = (c: any, issues: Issue[]) => ({
  issues,
  risk_pct: c.risk_pct,
  risk_band: issues.some((i) => i.severity === 'blocker') || c.risk_pct >= 0.5 ? 'High' : c.risk_pct >= 0.2 ? 'Medium' : 'Low',
  risk_model: c.risk_model,
  eta: etaView(c),
});

// ---------- today ----------
app.get('/v1/today', async (c) => {
  const latestBlocker = `exists (select 1 from precheck_results p, jsonb_array_elements(p.issues) i
    where p.claim_id = c.id and i->>'severity' = 'blocker'
    and p.created_at = (select max(created_at) from precheck_results where claim_id = c.id))`;
  const t = today();
  const wageMonth = addDays(t.slice(0, 8) + '01', -1).slice(0, 8) + '01';
  const [fix, rejected, overdue, salaryMissing, paymentsDue, escalations] = await Promise.all([
    query(`${CLAIM_ROW} where c.status in ('draft','checked') and (c.risk_pct >= 0.5 or ${latestBlocker}) order by c.risk_pct desc nulls last limit 50`),
    query(`${CLAIM_ROW} where c.status = 'rejected' order by c.rejected_at desc nulls last limit 50`),
    query(`${CLAIM_ROW} where c.status in ('submitted','under_process','resubmitted')
      and c.submitted_at + coalesce(c.eta_high, 30)::int < $1::date order by c.submitted_at limit 50`, [t]),
    query(`select er.id employer_id, er.name, $1::text wage_month from employers er
      where extract(day from $2::date) >= er.cycle_day
      and not exists (select 1 from salary_uploads s where s.employer_id = er.id and s.wage_month = $1::date) order by er.name`, [wageMonth, t]),
    query(`select er.id employer_id, er.name, s.wage_month, (s.wage_month + interval '1 month' + (er.due_day - 1) * interval '1 day')::date::text due_date
      from salary_uploads s join employers er on er.id = s.employer_id
      where s.status in ('received','validated') and s.wage_month = $1::date
      and (s.wage_month + interval '1 month' + (er.due_day - 1) * interval '1 day')::date <= $2::date + 3 order by due_date`, [wageMonth, t]),
    query(`select id, title, ref_id, created_at from tasks where kind = 'escalation' and not done order by created_at desc`),
  ]);
  return c.json({ fix_before_submit: fix, rejected, overdue, salary_missing: salaryMissing, payments_due: paymentsDue, escalations });
});
// ---------- monthly cycle (F5, Temporal) ----------
// wage_month 'YYYY-MM' or 'YYYY-MM-DD' -> 'YYYY-MM-01'; default: last month (the one being filed now)
const wageMonthOf = (s: unknown) => (/^\d{4}-\d{2}/.test(String(s ?? '')) ? String(s).slice(0, 7) + '-01' : addDays(today().slice(0, 8) + '01', -1).slice(0, 8) + '01');
app.post('/v1/employers/:id/cycle/start', async (c) => {
  const wm = wageMonthOf((await c.req.json().catch(() => ({}))).wage_month);
  const workflow = await startCycle(c.req.param('id'), wm);
  log('cycle_start', c.req.param('id'));
  return c.json({ ok: true, wage_month: wm, workflow, temporal: workflow !== null });
});
app.post('/v1/employers/:id/cycle/paid', async (c) => {
  const wm = wageMonthOf((await c.req.json().catch(() => ({}))).wage_month);
  await query(`update salary_uploads set status = 'paid' where employer_id = $1 and wage_month = $2`, [c.req.param('id'), wm]);
  const signalled = await cyclePaid(c.req.param('id'), wm);
  log('cycle_paid', c.req.param('id'));
  return c.json({ ok: true, temporal: !!signalled });
});
app.post('/v1/employers/:id/salary', async (c) => {
  const body = await c.req.parseBody();
  if (!(body.file instanceof File)) return c.json({ error: 'file required' }, 400);
  const employerId = c.req.param('id'), wm = wageMonthOf(body.wage_month);
  const { headers, rows } = await readSheet(body.file);
  let parsed;
  try { parsed = parseSalarySheet(headers, rows); } catch (err) { return c.json({ error: (err as Error).message }, 400); }
  if (!parsed.length) return c.json({ error: 'No employee rows found in the sheet' }, 400);
  // one upload per employer-month: a re-upload replaces the rows and goes back to validation
  const [old] = await query('select id from salary_uploads where employer_id = $1 and wage_month = $2 order by created_at desc limit 1', [employerId, wm]);
  const [u] = old
    ? await query(`update salary_uploads set rows = $2, validation = null, status = 'received', created_at = now() where id = $1 returning id`, [old.id, JSON.stringify(parsed)])
    : await query(`insert into salary_uploads (employer_id, wage_month, rows) values ($1,$2,$3) returning id`, [employerId, wm, JSON.stringify(parsed)]);
  await validateSalary(u.id); // same activity the workflow runs (idempotent), so validation works without Temporal
  const workflow = await cycleUploaded(employerId, wm, u.id);
  log('salary_upload', employerId);
  const [r] = await query('select validation from salary_uploads where id = $1', [u.id]);
  return c.json({ upload_id: u.id, wage_month: wm, validation: r.validation, temporal: !!workflow });
});
const CYCLE_STATE: Record<string, string> = { received: 'validating', validated: 'awaiting_payment', paid: 'paid', archived: 'paid' };
app.get('/v1/cycles', async (c) => {
  const wm = wageMonthOf(c.req.query('wage_month'));
  const rows = await query(`select er.id, er.name, er.cycle_day, er.due_day,
    (s.wage_month + interval '1 month' + (er.due_day - 1) * interval '1 day')::date::text due_date,
    s.id upload_id, s.status upload_status, s.created_at uploaded_at, s.validation
    from employers er left join lateral (select * from salary_uploads x where x.employer_id = er.id and x.wage_month = $1::date order by x.created_at desc limit 1) s on true
    order by er.name`, [wm]);
  const tasks = await query(`select id, kind, ref_id, title, body, due_at, created_at from tasks where kind in ('cycle','claim') and not done order by created_at desc limit 200`);
  const employers = await Promise.all(rows.map(async (r: any) => ({
    ...r, state: CYCLE_STATE[r.upload_status] ?? 'waiting_sheet',
    workflow: await cycleStatus(r.id, wm), // null when Temporal is off or no cycle was started
  })));
  return c.json({ wage_month: wm, employers, tasks });
});
app.post('/v1/tasks/:id/done', async (c) => {
  await query('update tasks set done = true where id = $1', [c.req.param('id')]);
  return c.json({ ok: true });
});

// ---------- employers / employees ----------
app.get('/v1/employers', async (c) => c.json(await query(`select er.id, er.name, er.establishment_code, er.contact_name,
  (select count(*)::int from employees e where e.employer_id = er.id) employee_count from employers er order by er.name`)));
app.post('/v1/employers', async (c) => {
  const b = await c.req.json();
  if (!b.name) return c.json({ error: 'name required' }, 400);
  const [r] = await query(`insert into employers (name, establishment_code, contact_name, contact_phone, cycle_day, due_day)
    values ($1,$2,$3,$4,coalesce($5,1),coalesce($6,15)) returning *`, [b.name, b.establishment_code, b.contact_name, b.contact_phone, b.cycle_day, b.due_day]);
  return c.json(r);
});
app.get('/v1/employees', async (c) => {
  const q = c.req.query('q') ?? '', employer = c.req.query('employer_id') || null;
  const rows = await query(`select e.id, e.employer_id, er.name employer_name, e.name_uan, e.uan, e.preferred_language, e.date_of_exit,
    (select count(*)::int from claims c where c.employee_id = e.id) claim_count
    from employees e join employers er on er.id = e.employer_id
    where ($1 = '' or e.name_uan ilike '%' || $1 || '%') and ($2::uuid is null or e.employer_id = $2::uuid)
    order by e.name_uan limit 200`, [q, employer]);
  return c.json(rows.map(({ uan, ...r }: any) => ({ ...r, uan_masked: mask(dec(uan) ?? '') })));
});
app.get('/v1/employees/:id', async (c) => {
  const e = await getEmployee(c.req.param('id'));
  if (!e) return c.json({ error: 'Not found' }, 404);
  log('view_employee', e.id);
  return c.json(maskedEmployee(e));
});

// ---------- claims ----------
app.get('/v1/claims', async (c) => {
  const s = c.req.query('status') || null;
  return c.json(await query(`${CLAIM_ROW} where ($1::text is null or c.status = $1) order by c.created_at desc limit 300`, [s]));
});
app.post('/v1/claims', async (c) => {
  const b = await c.req.json();
  if (!b.employee_id || !b.form) return c.json({ error: 'employee_id and form required' }, 400);
  const [r] = await query('insert into claims (employee_id, form, purpose) values ($1,$2,$3) returning *', [b.employee_id, b.form, b.purpose ?? null]);
  return c.json(r);
});
app.get('/v1/claims/:id', async (c) => {
  const [claim] = await query('select * from claims where id = $1', [c.req.param('id')]);
  if (!claim) return c.json({ error: 'Not found' }, 404);
  const e = await getEmployee(claim.employee_id);
  const [p] = await query('select issues from precheck_results where claim_id = $1 order by created_at desc limit 1', [claim.id]);
  log('view_claim', claim.id);
  return c.json({ claim, employee: maskedEmployee(e), precheck: p ? precheckView(claim, p.issues) : null });
});
app.patch('/v1/claims/:id', async (c) => {
  const b = await c.req.json();
  if (!STATUSES.includes(b.status)) return c.json({ error: 'bad status' }, 400);
  const dateCol = { submitted: 'submitted_at', resubmitted: 'submitted_at', settled: 'settled_at', rejected: 'rejected_at' }[b.status as string];
  const [r] = await query(`update claims set status = $2, rejection_remark = coalesce($3, rejection_remark)
    ${dateCol ? `, ${dateCol} = $4::date` : ''} where id = $1 returning *`,
    dateCol ? [c.req.param('id'), b.status, b.rejection_remark ?? null, today()] : [c.req.param('id'), b.status, b.rejection_remark ?? null]);
  if (!r) return c.json({ error: 'Not found' }, 404);
  log(`status_${b.status}`, r.id);
  void claimStatusChanged(r.id, b.status); // ClaimFollowUpWorkflow; never blocks or fails the request
  return c.json(r);
});
async function featureRow(e: any, claim: any, f: Record<string, any>): Promise<FeatureRow> {
  const [er] = await query(`select er.establishment_code, (select count(*)::int from employees x where x.employer_id = er.id) n
    from employers er where er.id = $1`, [e.employer_id]);
  return {
    ...(f as any), age_band: ageBand(e.dob_uan ?? e.dob_aadhaar, today()), employer_size_band: sizeBand(er?.n ?? 0),
    submit_month: Number((claim.submitted_at ?? today()).slice(5, 7)), office_code: (er?.establishment_code ?? '').slice(0, 5).toUpperCase() || 'unknown',
  };
}
async function precheckClaim(id: string, { fast = false } = {}) {
  const [claim] = await query('select * from claims where id = $1', [id]);
  if (!claim) return null;
  const e = facts(await getEmployee(claim.employee_id));
  const rules = await query('select id, title, params from rules');
  const others = await query('select id, form, status from claims where employee_id = $1 and id <> $2', [claim.employee_id, claim.id]);
  const issues = runChecks(e, claim, rules, others, today());
  const f = features(e, claim, today());
  const row = fast ? undefined : await featureRow(e, claim, f);
  const risk = await predictRisk(claim.form, f, row);
  const eta = await predictEta(claim.form, row);
  await query('insert into precheck_results (claim_id, issues, features) values ($1,$2,$3)', [claim.id, JSON.stringify(issues), JSON.stringify(f)]);
  const [updated] = await query(`update claims set risk_pct = $2, risk_model = $3, eta_days = $4, eta_low = $5, eta_high = $6, eta_model = $7,
    status = case when status = 'draft' then 'checked' else status end where id = $1 returning *`,
    [claim.id, risk.pct, risk.model, eta?.days ?? null, eta?.low ?? null, eta?.high ?? null, eta?.model ?? null]);
  return precheckView(updated, issues);
}
app.post('/v1/claims/:id/precheck', async (c) => {
  const r = await precheckClaim(c.req.param('id'));
  if (!r) return c.json({ error: 'Not found' }, 404);
  log('precheck', c.req.param('id'));
  return c.json(r);
});
app.get('/v1/claims/:id/eta', async (c) => {
  const [claim] = await query('select * from claims where id = $1', [c.req.param('id')]);
  return claim ? c.json(etaView(claim)) : c.json({ error: 'Not found' }, 404);
});

const llmError = (c: Context, err: unknown) => c.json({ error: `Model unavailable: ${(err as Error).message}` }, 503);

app.post('/v1/claims/:id/message', async (c) => {
  const { lang = 'hi' } = await c.req.json<{ lang?: Lang }>();
  if (!(lang in LANGS)) return c.json({ error: 'lang must be hi, mr or en' }, 400);
  const [claim] = await query('select * from claims where id = $1', [c.req.param('id')]);
  if (!claim) return c.json({ error: 'Not found' }, 404);
  const e = await getEmployee(claim.employee_id);
  const [p] = await query('select issues from precheck_results where claim_id = $1 order by created_at desc limit 1', [claim.id]);
  const issues: Issue[] = p?.issues ?? [];
  const task = issues.length
    ? `Problems found before submitting the claim:\n${issues.map((i) => `- ${i.message} Fix: ${i.fix} [${i.rule_id}]`).join('\n')}\nAsk the employee for exactly what is needed to fix these.`
    : `No problems were found. Tell the employee the Form ${claim.form} claim is being prepared and they will be updated.`;
  try {
    const text = await chat([
      { role: 'system', content: CONSULTANT_PROMPT },
      { role: 'user', content: `Write a short, polite WhatsApp message in ${LANGS[lang]} from the PF consultant's office to the employee ${e.name_uan} about their Form ${claim.form} claim.\n${task}\nUse simple words. No rule ids in the message. Output only the message text.` },
    ], employeePii(e), { kind: 'message' });
    return c.json({ text: text.trim(), model: env.LLM_MODEL });
  } catch (err) { return llmError(c, err); }
});

app.post('/v1/claims/:id/explain', async (c) => {
  const [claim] = await query('select * from claims where id = $1', [c.req.param('id')]);
  if (!claim) return c.json({ error: 'Not found' }, 404);
  const [p] = await query('select issues from precheck_results where claim_id = $1 order by created_at desc limit 1', [claim.id]);
  if (!p) return c.json({ error: 'Run Pre-check first' }, 400);
  const issues: Issue[] = p.issues;
  const e = await getEmployee(claim.employee_id);
  const rules = issues.length ? await query('select id, title, body from rules where id = any($1)', [[...new Set(issues.map((i) => i.rule_id))]]) : [];
  const v = precheckView(claim, issues);
  // context-first (PRD §8): facts gathered in code, the model only writes
  const facts = `Claim: Form ${claim.form} for employee ${e.name_uan}, status ${claim.status}.
Rejection risk: ${Math.round(v.risk_pct * 100)}% (${v.risk_band}), model ${v.risk_model}.
${v.eta ? `Settlement estimate if submitted today: ${Math.round(v.eta.low)}-${Math.round(v.eta.high)} days, most likely ${Math.round(v.eta.days)} (model ${v.eta.model}).` : 'No settlement estimate.'}
Problems found:
${issues.map((i) => `- [${i.rule_id}] (${i.severity}) ${i.message} Fix: ${i.fix}`).join('\n') || '- none'}
Rule Book entries:
${rules.map((r: any) => `[${r.id}] ${r.title}: ${r.body}`).join('\n') || '- none'}`;
  try {
    const text = await chat([
      { role: 'system', content: CONSULTANT_PROMPT },
      { role: 'user', content: `${facts}

Explain to the consultant in 3-5 short sentences of plain English: what to fix first and why, whether it is safe to submit now, and what the risk and estimate mean. Cite rule ids in square brackets. Don't repeat the mismatched names or values (the consultant sees them in the problem list); say which records differ and what to do.` },
    ], employeePii(e), { kind: 'explain' });
    return c.json({ text: text.trim(), model: env.LLM_MODEL });
  } catch (err) { return llmError(c, err); }
});

// Rejection Decoder (PRD §15). Stage 1 extraction: fine-tuned decoder (DECODER_MODEL, same prompt it was trained on),
// or Gemma few-shot when no fine-tune is installed. Stage 2: Gemma writes the employee messages from the facts.
const DECODER_PROMPT = readFileSync(resolve(import.meta.dirname, '../../../ml/decoder/system_prompt.txt'), 'utf8').trim();
const FINE_TUNED = !!env.DECODER_MODEL && env.DECODER_MODEL !== env.LLM_MODEL;
async function extractRemark(remark: string, pii: Pii) {
  const user = { role: 'user' as const, content: `Remark: ${remark}` };
  const shots = () => CATEGORIES.flatMap((cat) => {
    const r = REMARKS.find((x) => x.category === cat);
    const v = VOCAB.categories[cat];
    return r && v ? [{ role: 'user' as const, content: `Remark: ${r.text}` }, { role: 'assistant' as const, content: JSON.stringify({ category: cat, fields_involved: v.fields, fix_step_ids: v.fix }) }] : [];
  });
  const attempts = FINE_TUNED
    ? [{ model: env.DECODER_MODEL!, baseUrl: env.DECODER_BASE_URL, few: false }, { model: env.LLM_MODEL!, baseUrl: undefined, few: true }]
    : [{ model: env.LLM_MODEL!, baseUrl: undefined, few: true }];
  let lastErr: unknown;
  for (const a of attempts) {
    try {
      const raw = await chat([{ role: 'system', content: DECODER_PROMPT }, ...(a.few ? shots() : []), user], pii, { json: true, model: a.model, baseUrl: a.baseUrl, kind: 'decode' });
      const d = JSON.parse(raw);
      if (!CATEGORIES.includes(d.category)) throw new Error(`unknown category ${d.category}`);
      const pick = (xs: unknown, allowed: string[]) => (Array.isArray(xs) ? xs.filter((x) => allowed.includes(x)) : []);
      const allFix = Object.values(VOCAB.categories).flatMap((v) => v.fix);
      return { category: d.category as string, fields_involved: pick(d.fields_involved, VOCAB.fields), fix_step_ids: pick(d.fix_step_ids, allFix), model: a.few ? `${a.model} few-shot` : `${a.model} (fine-tuned)` };
    } catch (err) { lastErr = err; }
  }
  throw lastErr;
}
app.post('/v1/claims/:id/decode', async (c) => {
  const { remark } = await c.req.json();
  if (!remark?.trim()) return c.json({ error: 'remark required' }, 400);
  const [claim] = await query('select * from claims where id = $1', [c.req.param('id')]);
  if (!claim) return c.json({ error: 'Not found' }, 404);
  const e = await getEmployee(claim.employee_id);
  const pii = employeePii(e);
  try {
    const x = await extractRemark(remark, pii);
    const rules = await query('select id, title, body from rules where id = any($1)', [x.fix_step_ids]);
    const raw = await chat([
      { role: 'system', content: CONSULTANT_PROMPT },
      { role: 'user', content: `EPFO rejected ${e.name_uan}'s Form ${claim.form} claim. Problem: ${x.category.replaceAll('_', ' ')} (fields: ${x.fields_involved.join(', ') || 'unclear'}).
How to fix:\n${rules.map((r: any) => `[${r.id}] ${r.title}: ${r.body}`).join('\n') || '- ask the consultant'}
Write 1-2 short polite WhatsApp sentences to the employee saying exactly what document or correction is needed. No rule ids.
Reply with exactly this JSON shape: {"hi": "<message in Hindi, Devanagari script>", "mr": "<message in Marathi, Devanagari script>", "en": "<message in English>"}.` },
    ], pii, { json: true, kind: 'decode_message' });
    const j = JSON.parse(raw);
    const m = { hi: j.hi ?? j.hindi ?? j.Hindi, mr: j.mr ?? j.marathi ?? j.Marathi, en: j.en ?? j.english ?? j.English };
    const out = {
      category: x.category, fields_involved: x.fields_involved,
      fix_steps: rules.map((r: any) => ({ id: r.id, title: r.title })),
      employee_message_hi: m.hi ?? '', employee_message_mr: m.mr ?? '', employee_message_en: m.en ?? '',
      model: `${x.model} + ${env.LLM_MODEL} messages`,
    };
    await query('update claims set decoded = $2, rejection_remark = coalesce(rejection_remark, $3) where id = $1', [claim.id, JSON.stringify(out), remark]);
    return c.json(out);
  } catch (err) { return llmError(c, err); }
});

app.route('/v1/labels', labels);

// ---------- rule book ----------
const vec = (v: number[] | null) => (v ? `[${v.join(',')}]` : null);
const RULE_COLS = 'id, title, body, applies_to, source, params, last_verified_by, last_verified_at';
app.get('/v1/rules', async (c) => c.json(await query(`select ${RULE_COLS} from rules order by id`)));
app.get('/v1/rules/search', async (c) => c.json((await searchRules(c.req.query('q') ?? '', 8)).map(({ embedding, body_tsv, ...r }: any) => r)));
app.post('/v1/rules', async (c) => {
  const b = await c.req.json();
  if (!b.id || !b.title || !b.body || !b.source) return c.json({ error: 'id, title, body, source required' }, 400);
  const [r] = await query(`insert into rules (id, title, body, applies_to, source, params, last_verified_by, last_verified_at, embedding)
    values ($1,$2,$3,$4,$5,$6,$7, case when $7::text is null then null else current_date end, $8::vector) returning ${RULE_COLS}`,
    [b.id, b.title, b.body, b.applies_to ?? [], b.source, b.params ? JSON.stringify(b.params) : null, b.last_verified_by || null, vec(await embed(`${b.title}\n${b.body}`, 'document'))]);
  return c.json(r);
});
app.patch('/v1/rules/:id', async (c) => {
  const b = await c.req.json();
  const [old] = await query(`select ${RULE_COLS} from rules where id = $1`, [c.req.param('id')]);
  if (!old) return c.json({ error: 'Not found' }, 404);
  const m = { ...old, ...b };
  const verified = b.last_verified_by ? today() : old.last_verified_at;
  const [r] = await query(`update rules set title = $2, body = $3, applies_to = $4, source = $5, params = $6, last_verified_by = $7, last_verified_at = $8
    where id = $1 returning ${RULE_COLS}`, [old.id, m.title, m.body, m.applies_to, m.source, m.params ? JSON.stringify(m.params) : null, m.last_verified_by, verified]);
  if (m.title !== old.title || m.body !== old.body) {
    const v = await embed(`${m.title}\n${m.body}`, 'document');
    if (v) await query('update rules set embedding = $2::vector where id = $1', [old.id, vec(v)]);
  }
  return c.json(r);
});

// ---------- import (F8) ----------
const FIELDS: Record<string, string[]> = {
  uan: ['uan', 'uanno', 'uannumber'],
  name_uan: ['name', 'membername', 'employeename', 'nameasperuan', 'nameuan'],
  name_bank: ['nameasperbank', 'namebank', 'accountholdername'],
  name_aadhaar: ['nameasperaadhaar', 'nameaadhaar', 'aadhaarname'],
  father_name_uan: ['fathername', 'fathersname', 'fatherhusbandname', 'fathernameuan', 'spousename'],
  father_name_bank: ['fathernamebank', 'fathernameasperbank'],
  dob_uan: ['dob', 'dateofbirth', 'birthdate', 'dobuan'],
  dob_aadhaar: ['dobaadhaar', 'dobasperaadhaar'],
  aadhaar: ['aadhaar', 'aadhar', 'aadhaarno', 'aadharno', 'aadhaarnumber', 'uid'],
  aadhaar_linked: ['aadhaarlinked', 'aadharlinked', 'aadhaarseeded'],
  pan_present: ['pan', 'panno', 'panpresent'],
  bank_ifsc: ['ifsc', 'ifsccode', 'bankifsc'],
  bank_account: ['accountno', 'accountnumber', 'bankaccount', 'bankaccountno', 'acno'],
  bank_verified: ['bankverified', 'bankkycverified'],
  kyc_approved_by_employer: ['kycapproved', 'kycapprovedbyemployer', 'employerkyc'],
  date_of_joining: ['doj', 'dateofjoining', 'joiningdate'],
  date_of_exit: ['doe', 'dateofexit', 'exitdate', 'dateofleaving'],
  phone: ['phone', 'mobile', 'mobileno', 'phoneno', 'contact'],
  preferred_language: ['language', 'preferredlanguage', 'lang'],
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
async function readSheet(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '', dateNF: 'yyyy-mm-dd' });
  return { headers: (rows[0] ?? []).map(String), rows: rows.slice(1).filter((r) => r.some((v) => String(v).trim())) };
}
const toBool = (v: string) => (v === '' ? null : /^(y|yes|true|1|haan|ha)$/i.test(v.trim()));
const toDate = (v: string) => {
  v = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); // Indian sheets: DD/MM/YYYY
  if (!m) return null;
  const y = m[3].length === 2 ? (Number(m[3]) > 30 ? '19' : '20') + m[3] : m[3];
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};
app.post('/v1/import/preview', async (c) => {
  const { file } = await c.req.parseBody();
  if (!(file instanceof File)) return c.json({ error: 'file required' }, 400);
  const { headers, rows } = await readSheet(file);
  const suggested = Object.fromEntries(headers.map((h) => [h, Object.keys(FIELDS).find((f) => FIELDS[f].includes(norm(h))) ?? '']));
  // preview never shows full Aadhaar
  const aadhaarCols = headers.map((h, i) => (suggested[h] === 'aadhaar' ? i : -1)).filter((i) => i >= 0);
  const preview = rows.slice(0, 5).map((r) => r.map((v, i) => (aadhaarCols.includes(i) ? mask(String(v).replace(/\D/g, '')) : String(v))));
  return c.json({ headers, rows: preview, suggested, fields: Object.keys(FIELDS) });
});
app.post('/v1/import', async (c) => {
  const body = await c.req.parseBody();
  const file = body.file, employerId = String(body.employer_id ?? '');
  if (!(file instanceof File) || !employerId) return c.json({ error: 'file and employer_id required' }, 400);
  const mapping: Record<string, string> = JSON.parse(String(body.mapping ?? '{}'));
  const { headers, rows } = await readSheet(file);
  let inserted = 0, skipped = 0, aadhaar_dropped = 0;
  for (const r of rows) {
    const v: Record<string, string> = {};
    headers.forEach((h, i) => { if (mapping[h]) v[mapping[h]] = String(r[i] ?? '').trim(); });
    if (!v.name_uan) { skipped++; continue; }
    const aadhaar = (v.aadhaar ?? '').replace(/\D/g, '');
    if (aadhaar) aadhaar_dropped++;
    const lang = ['hi', 'mr', 'en'].includes(v.preferred_language?.toLowerCase()) ? v.preferred_language.toLowerCase() : 'hi';
    await query(`insert into employees (employer_id, uan, name_uan, name_bank, name_aadhaar, father_name_uan, father_name_bank, dob_uan, dob_aadhaar,
      aadhaar_last4, aadhaar_linked, pan_present, bank_ifsc, bank_account_enc, bank_verified, kyc_approved_by_employer, date_of_joining, date_of_exit, phone_enc, preferred_language)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`, [
      employerId, enc(v.uan?.replace(/\D/g, '') || null), v.name_uan, v.name_bank || null, v.name_aadhaar || null, v.father_name_uan || null, v.father_name_bank || null,
      toDate(v.dob_uan ?? ''), toDate(v.dob_aadhaar ?? ''), aadhaar.length >= 4 ? aadhaar.slice(-4) : null,
      toBool(v.aadhaar_linked ?? ''), v.pan_present != null ? v.pan_present !== '' : null,
      v.bank_ifsc?.toUpperCase() || null, enc(v.bank_account?.replace(/\D/g, '') || null), toBool(v.bank_verified ?? ''), toBool(v.kyc_approved_by_employer ?? ''),
      toDate(v.date_of_joining ?? ''), toDate(v.date_of_exit ?? ''), enc(v.phone?.replace(/\D/g, '').slice(-10) || null), lang,
    ]);
    inserted++;
  }
  log('import', employerId);
  return c.json({ inserted, skipped, aadhaar_dropped });
});

// ---------- employee helpline (F6, text) ----------
app.post('/v1/help-links', async (c) => {
  const { employee_id } = await c.req.json();
  if (!(await getEmployee(employee_id))) return c.json({ error: 'Not found' }, 404);
  const { token, hash } = newToken();
  const [r] = await query(`insert into help_links (token_hash, employee_id, expires_at) values ($1,$2, now() + interval '30 days') returning expires_at`, [hash, employee_id]);
  log('help_link_created', employee_id);
  return c.json({ url: `${PUBLIC_URL}/help/${token}`, expires_at: r.expires_at });
});
async function helpContext(token: string) {
  const [link] = await query('select employee_id, expires_at > now() valid from help_links where token_hash = $1', [hashToken(token)]);
  if (!link) return { status: 404 as const };
  if (!link.valid) return { status: 410 as const };
  const e = await getEmployee(link.employee_id);
  const rows = await query(`select * from claims where employee_id = $1 and status <> 'draft' order by created_at desc`, [e.id]);
  const claims = await Promise.all(rows.map(async (c: any) => {
    const pending = ['submitted', 'under_process', 'resubmitted'].includes(c.status);
    if (pending && c.eta_days == null) {
      const eta = await predictEta(c.form);
      if (eta) Object.assign(c, { eta_days: eta.days, eta_low: eta.low, eta_high: eta.high, eta_model: eta.model });
    }
    return { form: c.form, status: c.status, submitted_at: c.submitted_at, settled_at: c.settled_at, rejected: c.status === 'rejected', decoded_category: c.decoded?.category ?? null, eta: pending ? etaView(c) : null };
  }));
  return { status: 200 as const, e, claims };
}
app.get('/v1/help/:token', async (c) => {
  const h = await helpContext(c.req.param('token'));
  if (h.status !== 200) return c.json({ error: h.status === 410 ? 'This link has expired. Please ask your PF consultant for a new one.' : 'Link not found' }, h.status);
  log('help_open', h.e.id, 'employee');
  return c.json({
    first_name: h.e.name_uan.split(' ')[0], language: h.e.preferred_language,
    claims: h.claims.map((x: any) => ({ form: x.form, status: x.status, submitted_at: x.submitted_at, likely_date: x.eta?.likely_date ?? null, range: x.eta?.range ?? null })),
  });
});
app.post('/v1/help/:token/message', async (c) => {
  const h = await helpContext(c.req.param('token'));
  if (h.status !== 200) return c.json({ error: 'Link not valid' }, h.status);
  const { text, history = [] } = await c.req.json<{ text: string; history?: { role: 'user' | 'assistant'; content: string }[] }>();
  if (!text?.trim()) return c.json({ error: 'text required' }, 400);
  return c.json(await answerHelp(h, text, history, 'text'));
});

// ElevenLabs Agents "Custom LLM" (PRD §16): OpenAI-compatible, streamed. The agent's system prompt must contain
// `help_token: {{help_token}}` (dynamic variable set by the help page); auth = the agent's secret as Bearer token.
app.post('/v1/voice/llm/chat/completions', async (c) => {
  if (!env.VOICE_SHARED_SECRET || c.req.header('authorization') !== `Bearer ${env.VOICE_SHARED_SECRET}`) return c.json({ error: 'unauthorized' }, 401);
  const b = await c.req.json<{ messages: { role: string; content: any }[]; elevenlabs_extra_body?: { help_token?: string } }>();
  const text = (m: { content: any }) => (typeof m.content === 'string' ? m.content : (m.content ?? []).map((p: any) => p.text ?? '').join(''));
  const token = b.elevenlabs_extra_body?.help_token ?? b.messages.map(text).join('\n').match(/help_token:\s*([A-Za-z0-9_-]{16,})/)?.[1];
  const h = token ? await helpContext(token) : { status: 404 as const };
  const turns = b.messages.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role as 'user' | 'assistant', content: text(m) }));
  const last = turns.at(-1);
  const answer = h.status !== 200 ? 'This help link is not valid. Please ask your PF consultant for a new link.'
    : last?.role === 'user' && last.content.trim() ? (await answerHelp(h, last.content, turns.slice(0, -1), 'voice')).answer : '';
  const chunk = (delta: object, finish: string | null = null) =>
    `data: ${JSON.stringify({ id: 'pfd', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'pfdesk-helpline', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
  return new Response(chunk({ role: 'assistant', content: answer }) + chunk({}, 'stop') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
});
app.get('/v1/voice/config', (c) => c.json({ agent_id: env.ELEVENLABS_AGENT_ID || null }));

async function answerHelp(h: Extract<Awaited<ReturnType<typeof helpContext>>, { status: 200 }>, text: string,
  history: { role: 'user' | 'assistant'; content: string }[], channel: 'text' | 'voice') {
  const pii = employeePii(h.e);
  const hits = await searchRules(text, 3).catch(() => []);
  const context = `Today: ${today()}. Employee's preferred language: ${LANGS[h.e.preferred_language as Lang] ?? 'Hindi'} (reply in the language the employee writes in).
Claims (facts):\n${h.claims.length ? h.claims.map((x: any) => `- Form ${x.form}: status ${x.status}${x.submitted_at ? `, submitted ${x.submitted_at}` : ''}${x.eta ? `, settlement estimate ${x.eta.range[0]} to ${x.eta.range[1]} (most likely ${x.eta.likely_date})` : ', NO settlement estimate available — do not give any date'}${x.rejected ? ' — REJECTED, consultant must handle' : ''}`).join('\n') : '- No submitted claims yet.'}
Rule Book entries:\n${hits.map((r: any) => `[${r.id}] ${r.title}: ${r.body}`).join('\n') || '- none matched'}`;
  let answer: string, escalate: boolean;
  try {
    const ask = async () => JSON.parse(await chat([
      { role: 'system', content: `${HELPLINE_PROMPT}\n\n${context}` },
      ...history.slice(-6),
      { role: 'user', content: text },
    ], pii, { json: true, kind: 'helpline' }));
    let d = await ask();
    if (FOREIGN_SCRIPT.test(String(d.answer ?? ''))) d = await ask();
    answer = String(d.answer ?? '').replace(new RegExp(FOREIGN_SCRIPT.source, 'g'), '');
    escalate = !!d.escalate || h.claims.some((x: any) => x.rejected) || !answer;
    // off-topic: never let the model improvise advice; hand to the consultant
    if (d.topic !== 'status' && d.topic !== 'documents') { answer = CALLBACK[(h.e.preferred_language as Lang) ?? 'hi'] ?? CALLBACK.hi; escalate = true; }
    else if (h.claims.some((x: any) => x.rejected) && !h.claims.some((x: any) => x.eta)) answer = REJECTED[(h.e.preferred_language as Lang) ?? 'hi'] ?? REJECTED.hi;
  } catch {
    answer = 'Sorry, I could not answer right now. Your PF consultant will call you.';
    escalate = true;
  }
  if (escalate) await query(`insert into tasks (kind, ref_id, title) select 'escalation', $1::uuid, $2
    where not exists (select 1 from tasks where kind = 'escalation' and ref_id = $1::uuid and not done)`, [h.e.id, `Helpline: ${h.e.name_uan.split(' ')[0]} asked "${pii.tokenize(text).slice(0, 120)}" — please call`]);
  await query(`insert into help_sessions (employee_id, channel, transcript_redacted, resolved, escalated) values ($1,$5,$2,$3,$4)`,
    [h.e.id, JSON.stringify([{ role: 'user', content: pii.tokenize(text) }, { role: 'assistant', content: pii.tokenize(answer) }]), !escalate, escalate, channel]);
  return { answer, escalated: escalate };
}

// ---------- boot ----------
// Listen first, then migrate/seed: on a hosted DB far away, seeding the demo takes minutes and the
// platform's health check would otherwise kill us before we ever answer. /v1 says "starting" until ready.
const port = Number(env.API_PORT || env.PORT || 8787);
serve({ fetch: app.fetch, port }, () => console.log(`PF Desk API on :${port} (demo=${DEMO})`));
try {
  const t0 = Date.now();
  await migrate();
  await seedRules();
  if (DEMO) {
    console.log('[boot] seeding demo data…', await seedDemo());
    // demo realism: the consultant has already run Pre-check on open claims
    for (const { id } of await query(`select id from claims c where status in ('draft','checked') and not exists (select 1 from precheck_results p where p.claim_id = c.id)`)) await precheckClaim(id, { fast: true });
  }
  booting = false;
  console.log(`[boot] ready in ${Math.round((Date.now() - t0) / 1000)}s`);
  embedMissingRules().catch((err) => console.warn('embedding skipped:', err.message));
} catch (err) {
  bootError = (err as Error).message;
  console.error('[boot] FAILED:', err);
}
// Temporal worker in-process: embedded PGlite is one process per data dir. With DATABASE_URL you can set
// TEMPORAL_WORKER=off and run `pnpm --filter api worker` separately. Retries quietly while Temporal is down.
if (env.TEMPORAL_WORKER !== 'off') import('./worker.ts').then((w) => w.runWorkerForever()).catch((err) => console.warn('[temporal] worker disabled:', err.message));
