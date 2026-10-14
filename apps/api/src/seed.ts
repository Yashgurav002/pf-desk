// Rule Book seed + synthetic demo data. CLI: node --env-file-if-exists=../../.env src/seed.ts --reset
import { query, migrate, close } from './db.ts';
import { enc } from './crypto.ts';
import { embed } from './llm.ts';
import { vecLiteral } from './search.ts';
import { makeDataset } from './synthetic.ts';

const SOURCE = 'PRD starting point — VERIFY with consultant and current EPFO circulars';
const CLAIM_FORMS = ['19', '10C', '31', '13', '10D', '5IF'];

type Seed = { id: string; title: string; body: string; applies_to: string[]; params?: Record<string, any> };

// Plain-English starting points. None of these are verified: each must be confirmed by the consultant.
export const RULES: Seed[] = [
  // --- check rules (used by checks.ts) ---
  { id: 'R-NAME-MATCH', title: 'Name must match across UAN, Aadhaar and bank', applies_to: CLAIM_FORMS, params: { block_below: 0.85 },
    body: 'The member name on the UAN (EPFO records), on Aadhaar and on the bank account should be the same. Small spelling differences, missing middle names or initials are a very common reason for claim rejection. Fix: correct the name through a joint declaration or the member portal so all three records match before filing.' },
  { id: 'R-FATHER-NAME', title: "Father's name must match", applies_to: CLAIM_FORMS, params: { block_below: 0.85 },
    body: "The father's (or husband's) name in EPFO records should match the name in other documents such as the bank account. A mismatch can lead to rejection. Fix: correct it through a joint declaration with employer approval before filing the claim." },
  { id: 'R-DOB', title: 'Date of birth must match UAN and Aadhaar', applies_to: CLAIM_FORMS,
    body: 'The date of birth in EPFO records must match the date of birth on Aadhaar. A different date of birth is a common rejection reason and also blocks Aadhaar-based verification. Fix: request a date of birth correction with supporting documents before submitting the claim.' },
  { id: 'R-IFSC', title: 'Bank IFSC must be valid', applies_to: CLAIM_FORMS,
    body: 'The IFSC code of the bank branch must be valid: 11 characters, four letters for the bank, then 0, then six letters or digits for the branch. A wrong or old IFSC (for example after a bank merger) causes payment failure. Fix: take the IFSC from a recent passbook or cancelled cheque and update the bank KYC.' },
  { id: 'R-BANK-ACCOUNT', title: 'Bank account number must be present and correct', applies_to: CLAIM_FORMS,
    body: 'The claim amount is paid only into the bank account seeded in the member KYC. The account must belong to the member, be active, and the number must be complete and correct. Joint accounts may need extra checks. Fix: update the bank KYC with a clear cancelled cheque or passbook copy.' },
  { id: 'R-BANK-VERIFIED', title: 'Bank KYC must be verified', applies_to: CLAIM_FORMS,
    body: 'The bank account in KYC must be verified (approved by the employer and verified by the bank or EPFO) before a claim is filed. Claims with an unverified bank account are usually rejected or returned. Fix: get the employer to approve the bank KYC and wait for verification.' },
  { id: 'R-KYC-EMPLOYER', title: 'KYC must be approved by the employer', applies_to: CLAIM_FORMS,
    body: 'KYC details uploaded by a member (bank, PAN, Aadhaar) are pending until the employer approves them using its digital signature. Claims filed while KYC is pending are commonly rejected. Fix: ask the employer to approve pending KYC on the employer portal.' },
  { id: 'R-AADHAAR-LINK', title: 'Aadhaar must be linked and verified with UAN', applies_to: CLAIM_FORMS,
    body: 'Aadhaar should be linked to the UAN and verified. Online claims need Aadhaar-based OTP, and claims without a verified Aadhaar link are often rejected. Fix: link and verify Aadhaar with the UAN, making sure name, date of birth and gender match Aadhaar.' },
  { id: 'R-EXIT-DATE', title: 'Date of exit must be marked before a final claim', applies_to: ['19', '10C', '13'], params: { forms: ['19', '10C', '13'] },
    body: 'For final settlement (Form 19), pension withdrawal (Form 10C) and in many transfer cases (Form 13), the date of exit and reason for leaving must be marked by the employer or the member. If the exit date is missing the claim cannot be processed. Fix: ask the employer to mark the exit date, or the member can mark it after the allowed period.' },
  { id: 'R-WAITING-PERIOD', title: 'Waiting period after leaving the job', applies_to: ['19', '10C'], params: { days: 60, forms: ['19', '10C'] },
    body: 'A final PF settlement or pension withdrawal is normally allowed only after a waiting period (often described as two months, about 60 days) after leaving employment without joining a new covered employer. This rule may have changed recently — check the current EPFO rule before advising.' },
  { id: 'R-DUPLICATE', title: 'Do not file a duplicate claim', applies_to: CLAIM_FORMS,
    body: 'If a claim of the same type is already pending or was recently settled for the same member, a new one will be rejected as a duplicate. Fix: check the claim status first; wait for the pending claim to be settled or rejected before filing again.' },
  // --- info entries ---
  { id: 'R-CONTRIB-SPLIT', title: 'How PF contributions are split', applies_to: ['contribution'],
    body: 'The employee contributes 12% of basic wages plus dearness allowance (DA). The employer also contributes 12%: about 8.33% goes to the pension scheme (EPS), on wages capped at the wage ceiling, and the rest goes to the provident fund (EPF).' },
  { id: 'R-WAGE-CEILING', title: 'Wage ceiling (₹15,000)', applies_to: ['contribution'],
    body: 'The wage ceiling is ₹15,000 per month. Pension (EPS) contribution is calculated on wages up to this ceiling, and membership is mandatory for employees earning up to this amount. Higher earners may join voluntarily.' },
  { id: 'R-EDLI', title: 'EDLI insurance contribution', applies_to: ['contribution', '5IF'],
    body: "The Employees' Deposit Linked Insurance (EDLI) scheme gives life cover to members. The employer pays about 0.5% of wages, up to the wage ceiling. The employee pays nothing for EDLI." },
  { id: 'R-ADMIN', title: 'Administrative charges', applies_to: ['contribution'],
    body: 'The employer pays administrative charges of about 0.5% of wages, with a fixed monthly minimum amount. These are paid along with the monthly contribution.' },
  { id: 'R-DUE-DATE', title: 'Monthly return and payment due date', applies_to: ['contribution'],
    body: 'The monthly ECR (electronic challan cum return) must be filed and PF dues paid by the 15th of the following month. Late payment attracts interest and penal damages, and delays can also hold up member claims.' },
  { id: 'R-FORM-19', title: 'Form 19 — final PF settlement', applies_to: ['19'],
    body: 'Form 19 is used to withdraw the full provident fund balance (final settlement) after leaving the job, usually after the waiting period. Exit date, KYC, bank details and Aadhaar must all be in order.' },
  { id: 'R-FORM-10C', title: 'Form 10C — pension withdrawal benefit or scheme certificate', applies_to: ['10C'],
    body: 'Form 10C is used to withdraw the pension (EPS) amount when service is less than 10 years (withdrawal benefit), or to get a scheme certificate to carry pension service forward. It is often filed together with Form 19 when leaving a job.' },
  { id: 'R-FORM-31', title: 'Form 31 — advance or partial withdrawal', applies_to: ['31'],
    body: 'Form 31 is used to take an advance (partial withdrawal) from PF while still employed, for purposes such as illness, marriage, education, house purchase or repair. Each purpose has its own minimum service and limit.' },
  { id: 'R-FORM-13', title: 'Form 13 — transfer of PF account', applies_to: ['13'],
    body: 'Form 13 is used to transfer PF and pension balance from a previous employer to the current employer account when changing jobs, so the service and money stay together under one UAN.' },
  { id: 'R-FORM-10D', title: 'Form 10D — monthly pension', applies_to: ['10D'],
    body: 'Form 10D is used to claim a monthly pension under EPS: on retirement after 10 or more years of service, early pension, disability, or by family members (widow, children, nominee) after the death of a member.' },
  { id: 'R-FORM-5IF', title: 'Form 5IF — EDLI death claim', applies_to: ['5IF'],
    body: 'Form 5IF is used by the nominee or legal heir to claim the EDLI insurance amount when a member dies while in service. It is usually filed along with Form 20 (PF) and Form 10D (pension) for the family.' },
  { id: 'R-PARTIAL-WITHDRAWAL', title: 'Partial withdrawal: purposes, service and limits', applies_to: ['31'],
    body: 'Partial withdrawals (advances) are allowed only for listed purposes, each with a minimum service period and a maximum amount. EPFO has simplified these categories recently, so check the current rule before advising a member.' },
  { id: 'R-DOCS-CLEAR', title: 'Cheque or passbook image must be clear', applies_to: CLAIM_FORMS,
    body: 'The uploaded cancelled cheque or passbook page must be clear and show the member name, account number and IFSC. A blurred or cut image is a common rejection reason. Fix: re-upload a clear, full image.' },
  { id: 'R-SERVICE-PERIOD', title: 'Service period must meet the requirement', applies_to: ['10C', '10D', '31'],
    body: 'Some claims depend on the length of service: pension withdrawal is for service under 10 years, monthly pension needs 10 or more years, and advances need a minimum service. A claim for an ineligible service period is rejected.' },
];

export async function seedRules(): Promise<number> {
  for (const r of RULES) {
    await query(
      `insert into rules (id, title, body, applies_to, params, source, last_verified_by) values ($1,$2,$3,$4,$5,$6,null)
       on conflict (id) do nothing`,
      [r.id, r.title, r.body, r.applies_to, r.params ? JSON.stringify(r.params) : null, SOURCE],
    );
  }
  return RULES.length;
}

/** Best effort: embed rules with null embeddings. Returns how many were embedded. */
export async function embedMissingRules(): Promise<number> {
  const rows = await query<{ id: string; title: string; body: string }>('select id, title, body from rules where embedding is null');
  let n = 0;
  for (const r of rows) {
    const v = await embed(`${r.title}. ${r.body}`, 'document');
    if (!v) break; // model unavailable; try again later
    await query('update rules set embedding = $1::vector where id = $2', [vecLiteral(v), r.id]);
    n++;
  }
  return n;
}

const pick = (o: any, cols: string[]) => cols.filter((c) => o[c] !== undefined);

async function insert(table: string, o: Record<string, any>, cols: string[]): Promise<string | undefined> {
  const use = pick(o, cols);
  const vals = use.map((c) => (o[c] !== null && typeof o[c] === 'object' ? JSON.stringify(o[c]) : o[c]));
  const rows = await query<{ id: string }>(
    `insert into ${table} (${use.join(',')}) values (${use.map((_, i) => `$${i + 1}`).join(',')}) returning id`,
    vals,
  );
  return rows[0]?.id;
}

const EMPLOYER_COLS = ['name', 'establishment_code', 'contact_name', 'contact_phone', 'cycle_day', 'due_day'];
const EMPLOYEE_COLS = ['name_uan', 'name_bank', 'name_aadhaar', 'father_name_uan', 'father_name_bank', 'dob_uan', 'dob_aadhaar',
  'aadhaar_last4', 'aadhaar_linked', 'pan_present', 'bank_ifsc', 'bank_verified', 'kyc_approved_by_employer',
  'date_of_joining', 'date_of_exit', 'preferred_language'];
const CLAIM_COLS = ['form', 'created_at', 'purpose', 'status', 'submitted_at', 'settled_at', 'rejected_at', 'rejection_remark'];
const HISTORY_COLS = ['form', 'service_months', 'age_band', 'employer_size_band', 'name_match', 'father_match', 'dob_match',
  'bank_verified', 'kyc_approved', 'aadhaar_linked', 'exit_marked', 'months_since_exit', 'submitted_at', 'submit_month', 'office_code',
  'outcome', 'days_to_outcome', 'rejection_category'];

/** Loads synthetic data (DEMO_MODE only, and only into an empty DB). */
export async function seedDemo(): Promise<Record<string, number>> {
  if (process.env.DEMO_MODE !== 'true') throw new Error('seedDemo refused: DEMO_MODE is not "true" (synthetic data only goes into demo databases)');
  const [{ n }] = await query<{ n: number }>('select count(*)::int n from employers');
  if (n > 0) return { skipped: n };

  const ds = makeDataset();
  const employerIds: string[] = [];
  for (const e of ds.employers) employerIds.push((await insert('employers', e, EMPLOYER_COLS))!);

  const employeeIds: string[] = [];
  for (const e of ds.employees as any[]) {
    const row = {
      ...e,
      aadhaar_last4: e.aadhaar_last4 ? String(e.aadhaar_last4).slice(-4) : null, // never the full number
      employer_id: employerIds[e.employer_idx],
      uan: enc(e.uan ?? null),
      bank_account_enc: enc(e.bank_account ?? null),
      phone_enc: enc(e.phone ?? null),
    };
    employeeIds.push((await insert('employees', row, ['employer_id', 'uan', 'bank_account_enc', 'phone_enc', ...EMPLOYEE_COLS]))!);
  }

  for (const c of ds.claims as any[]) await insert('claims', { ...c, employee_id: employeeIds[c.employee_idx] }, ['employee_id', ...CLAIM_COLS]);
  for (const h of ds.history) await insert('history_claims', h, HISTORY_COLS);

  // Last wage month's salary uploads, mixed statuses (the monthly cycle is a later phase).
  const d = new Date();
  const wageMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const statuses = ['paid', 'validated', 'received'];
  const uploads = employerIds.slice(0, Math.max(0, employerIds.length - 2)); // last two employers: not received yet
  for (const [i, id] of uploads.entries()) {
    await insert('salary_uploads', {
      employer_id: id, wage_month: wageMonth, status: statuses[i % 3],
      rows: [], validation: { rows: 0, note: 'synthetic placeholder' },
    }, ['employer_id', 'wage_month', 'rows', 'validation', 'status']);
  }

  return {
    employers: employerIds.length, employees: employeeIds.length, claims: ds.claims.length,
    history_claims: ds.history.length, salary_uploads: uploads.length,
  };
}

const TABLES = ['access_log', 'agent_runs', 'tasks', 'help_sessions', 'help_links', 'precheck_results', 'claims',
  'salary_uploads', 'employees', 'employers', 'history_claims', 'rules'];

if (process.argv[1] && import.meta.filename === (await import('node:path')).resolve(process.argv[1])) {
  try {
    await migrate();
    if (process.argv.includes('--reset')) {
      await query(`truncate ${TABLES.join(', ')} restart identity cascade`);
      console.log('reset: all tables truncated');
    }
    console.log('rules:', await seedRules());
    console.log('demo:', await seedDemo());
    console.log('embedded:', await embedMissingRules());
    const counts = await query(`select ${TABLES.map((t) => `(select count(*)::int from ${t}) ${t}`).join(', ')}`);
    console.log('counts:', counts[0]);
  } finally {
    await close();
  }
}
