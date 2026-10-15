// Temporal activities (PRD §13). Each one is idempotent so retries and worker restarts never duplicate rows.
import { query } from './db.ts';
import { features } from './checks.ts';
import { ageBand, sizeBand } from './tabpfn.ts';
import { validateSalary as validateRows, ruleParams } from './salary.ts';
import type { SalaryRow } from './salary.ts';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export async function loadCycle(employerId: string, wageMonth: string) {
  const [e] = await query(`select er.id, er.name, er.contact_name, er.cycle_day, er.due_day,
    (select s.id from salary_uploads s where s.employer_id = er.id and s.wage_month = $2::date order by s.created_at desc limit 1) upload_id,
    exists (select 1 from salary_uploads s where s.employer_id = er.id and s.wage_month = $2::date and s.status in ('paid','archived')) paid
    from employers er where er.id = $1`, [employerId, `${wageMonth}-01`]);
  if (!e) throw new Error(`employer ${employerId} not found`);
  return e as { id: string; name: string; contact_name: string | null; cycle_day: number; due_day: number; upload_id: string | null; paid: boolean };
}

/** Natural key `dedupe_key` (workflow id + step): a replayed or retried call is a no-op. */
export async function createTask(t: { key: string; kind: string; ref_id: string; title: string; body?: string | null; due_at?: string | null }) {
  await query(`insert into tasks (kind, ref_id, title, body, due_at, dedupe_key) values ($1,$2,$3,$4,$5,$6) on conflict (dedupe_key) do nothing`,
    [t.kind, t.ref_id, t.title, t.body ?? null, t.due_at ?? null, t.key]);
}

/** Validates an upload against last month's and stores the result. Also called directly by the API on upload. */
export async function validateSalary(uploadId: string) {
  const [u] = await query('select id, employer_id, wage_month, rows from salary_uploads where id = $1', [uploadId]);
  if (!u) throw new Error(`upload ${uploadId} not found`);
  const [prev] = await query(`select rows from salary_uploads where employer_id = $1 and wage_month = ($2::date - interval '1 month')::date
    order by created_at desc limit 1`, [u.employer_id, u.wage_month]);
  const params = ruleParams(await query(`select id, params from rules where id in ('R-CONTRIB-SPLIT','R-WAGE-CEILING','R-EDLI','R-ADMIN')`));
  const v = validateRows(u.rows as SalaryRow[], prev?.rows?.length ? prev.rows : null, params);
  await query(`update salary_uploads set validation = $2, status = case when status = 'received' then 'validated' else status end where id = $1`, [uploadId, JSON.stringify(v)]);
  return { summary: v.summary, flag_count: v.flag_count, total: v.totals.total };
}

export async function archiveCycle(employerId: string, wageMonth: string) {
  await query(`update salary_uploads set status = 'archived' where employer_id = $1 and wage_month = $2::date and status = 'paid'`, [employerId, `${wageMonth}-01`]);
}

export async function claimInfo(claimId: string) {
  const [c] = await query(`select c.form, c.status, c.eta_high, e.name_uan from claims c join employees e on e.id = c.employee_id where c.id = $1`, [claimId]);
  if (!c) throw new Error(`claim ${claimId} not found`);
  return { form: c.form as string, status: c.status as string, eta_high: c.eta_high as number | null, first_name: String(c.name_uan ?? '').split(' ')[0] };
}

/** Settled or rejected claim -> history_claims (new TabPFN training row, de-identified columns only). Once per claim and outcome. */
export async function recordOutcome(claimId: string) {
  const [c] = await query('select * from claims where id = $1', [claimId]);
  if (!c || (c.status !== 'settled' && c.status !== 'rejected')) return false;
  const [e] = await query('select * from employees where id = $1', [c.employee_id]);
  const [er] = await query(`select er.establishment_code, (select count(*)::int from employees x where x.employer_id = er.id) n from employers er where er.id = $1`, [e.employer_id]);
  const asOf = (c.status === 'settled' ? c.settled_at : c.rejected_at) ?? today();
  const f = features(e, c, c.submitted_at ?? asOf);
  const days = c.submitted_at ? Math.round((Date.parse(asOf) - Date.parse(c.submitted_at)) / 864e5) : null;
  await query(`insert into history_claims (claim_id, form, service_months, age_band, employer_size_band, name_match, father_match, dob_match, bank_verified,
    kyc_approved, aadhaar_linked, exit_marked, months_since_exit, submitted_at, submit_month, office_code, outcome, days_to_outcome, rejection_category)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$18,$17,$19) on conflict (claim_id, outcome) do nothing`, [
    claimId, f.form, f.service_months, ageBand(e.dob_uan ?? e.dob_aadhaar, asOf), sizeBand(er?.n ?? 0), f.name_match, f.father_match, f.dob_match, f.bank_verified,
    f.kyc_approved, f.aadhaar_linked, f.exit_marked, f.months_since_exit, c.submitted_at, c.submitted_at ? Number(c.submitted_at.slice(5, 7)) : null,
    (er?.establishment_code ?? '').slice(0, 5).toUpperCase() || 'unknown', days, c.status, c.decoded?.category ?? null,
  ]);
  return true;
}
