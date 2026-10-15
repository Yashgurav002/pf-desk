// Rule Book seed + synthetic demo data. CLI: node --env-file-if-exists=../../.env src/seed.ts --reset
import { query, migrate, close } from './db.ts';
import { enc } from './crypto.ts';
import { embed } from './llm.ts';
import { vecLiteral } from './search.ts';
import { makeDataset, makeSalaryMonths } from './synthetic.ts';
import { validateSalary } from './activities.ts';

const SOURCE = 'Unconfirmed — verify with consultant';
const CLAIM_FORMS = ['19', '10C', '31', '13', '10D', '5IF'];

// Official sources, checked 2026-10-15 (details in docs/research/rules.md).
const src = (s: string) => `${s}; checked 2026-10-15`;
const EPF26 = "EPF Scheme, 2026 (G.S.R. 525(E) dated 29 Jun 2026, in force 1 Jul 2026), scheme text: https://taxguru.in/corporate-law/employees-provident-funds-scheme-2026.html";
const EPS26 = 'EPS, 2026 notified 29 Jun 2026, summary: https://www.scconline.com/blog/post/2026/07/05/employees-pension-scheme-2026-key-changes/';
const PIB = (id: string, date: string) => `PIB ${date} https://www.pib.gov.in/PressReleasePage.aspx?PRID=${id}`;
const CBT238 = PIB('2178522', '13 Oct 2025 (238th CBT)');
const CLARIFY = PIB('2179689', '15 Oct 2025');
const JD = PIB('2094229', '19 Jan 2025');
const BANK = PIB('2118168', '3 Apr 2025');
const WAGE = 'PIB 16 Sep 2026 (Release ID 2310973) https://www.labour.gov.in/static/uploads/2026/09/4f607a88c5342aeb980c6b999997caab.pdf';
const EDLI = 'EPFO EDLI page https://pmvbry.epfindia.gov.in/insurance-scheme-edli; ' + PIB('2234502', '2 Mar 2026 (239th CBT)');

type Seed = { id: string; title: string; body: string; applies_to: string[]; params?: Record<string, any>; source?: string };

// Plain-English rules checked against public official sources. The consultant still confirms each one.
export const RULES: Seed[] = [
  // --- check rules (used by checks.ts) ---
  { id: 'R-NAME-MATCH', title: 'Name must match across UAN, Aadhaar and bank', applies_to: CLAIM_FORMS, params: { block_below: 0.85 }, source: src(`${JD}; ${BANK}`),
    body: 'The member name on the UAN (EPFO records), on Aadhaar and on the bank account should be the same. Small spelling differences, missing middle names or initials are a very common reason for claim rejection, and the bank account name is matched with UAN when the bank is seeded. Fix: if the UAN is Aadhaar-verified, the member can correct the name on the member portal without documents or employer approval (since January 2025); UANs made before 1 October 2017 need employer certification.' },
  { id: 'R-FATHER-NAME', title: "Father's name must match", applies_to: CLAIM_FORMS, params: { block_below: 0.85 }, source: src(JD),
    body: "The father's (or mother's) name in EPFO records should match other documents such as the bank account. A mismatch can lead to rejection. Fix: correct it on the member portal (joint declaration). Members with an Aadhaar-verified UAN can do it themselves without documents; otherwise the employer approves it." },
  { id: 'R-DOB', title: 'Date of birth must match UAN and Aadhaar', applies_to: CLAIM_FORMS, source: src(JD),
    body: 'The date of birth in EPFO records must match the date of birth on Aadhaar. A different date of birth is a common rejection reason and also blocks Aadhaar-based verification. Fix: correct the date of birth on the member portal before submitting the claim. With an Aadhaar-verified UAN the member can do it without documents; UANs made before 1 October 2017 need employer certification.' },
  { id: 'R-IFSC', title: 'Bank IFSC must be valid', applies_to: CLAIM_FORMS, source: src(`Standard RBI IFSC format; bank seeding is verified with the bank: ${BANK}`),
    body: 'The IFSC code of the bank branch must be valid: 11 characters, four letters for the bank, then 0, then six letters or digits for the branch. A wrong or old IFSC (for example after a bank merger) causes payment failure. Fix: take the IFSC from a recent passbook or cheque and update the bank details on the member portal.' },
  { id: 'R-BANK-ACCOUNT', title: 'Bank account number must be present and correct', applies_to: CLAIM_FORMS, source: src(`${BANK}; ${EPF26} para 25`),
    body: "The claim amount is paid only into the bank account seeded with the UAN. The account must be in the member's name, active and Aadhaar-seeded, and the number must be complete and correct. Fix: update the bank details on the member portal; the bank verifies them. Since April 2025 no cheque image and no employer approval are needed for this." },
  { id: 'R-BANK-VERIFIED', title: 'Bank account must be verified by the bank', applies_to: CLAIM_FORMS, source: src(BANK),
    body: 'The bank account seeded with the UAN must be verified by the bank before a claim is filed. Since April 2025 the employer no longer approves bank seeding: once the bank verifies it, it is done. Claims with an unverified bank account are usually rejected or returned. Fix: check the status on the member portal; if the bank rejected it, fix the name or account number at the bank and seed it again.' },
  { id: 'R-KYC-EMPLOYER', title: 'Pending KYC must be approved by the employer', applies_to: CLAIM_FORMS, source: src(`${JD}; ${BANK}`),
    body: 'Some KYC requests (for example PAN, or profile corrections for UANs that are not Aadhaar-verified or were made before 1 October 2017) still wait for the employer to approve them with its digital signature. Bank seeding no longer needs employer approval (April 2025), and members with an Aadhaar-verified UAN can self-approve most profile corrections (January 2025). Fix: ask the employer to approve whatever is still pending on the employer portal.' },
  { id: 'R-AADHAAR-LINK', title: 'Aadhaar must be linked and verified with UAN', applies_to: CLAIM_FORMS, source: src(`${EPF26} para 25; ${PIB('2120326', '9 Apr 2025')}`),
    body: 'Aadhaar must be linked to the UAN and verified. The EPF Scheme, 2026 asks every member to give Aadhaar, PAN and an Aadhaar-seeded bank account, and online claims use Aadhaar OTP. Members can also generate and activate a UAN themselves with Aadhaar face authentication in the UMANG app. Fix: link and verify Aadhaar, making sure name, date of birth and gender match Aadhaar.' },
  { id: 'R-EXIT-DATE', title: 'Date of exit must be marked before a final claim', applies_to: ['19', '10C', '13'], params: { forms: ['19', '10C', '13'] }, source: src(JD),
    body: 'For final settlement (Form 19), pension withdrawal (Form 10C) and many transfers (Form 13), the date of exit must be marked. If it is missing the claim cannot be processed. Fix: ask the employer to mark it on the employer portal. Since January 2025 a member with an Aadhaar-verified UAN can also update the date of leaving on the member portal.' },
  { id: 'R-WAITING-PERIOD', title: 'Waiting period after leaving the job', applies_to: ['19', '10C'], params: { days: { '19': 366, '10C': 1096 }, forms: ['19', '10C'] }, source: src(`${EPF26} para 49(2); ${EPS26}; ${CBT238}; ${CLARIFY}`),
    body: 'From 1 July 2026 (EPF Scheme, 2026) a full PF withdrawal after leaving a job is allowed only after 12 months without a covered job (it was 2 months). Women members who resign are exempt (the old rule said: to get married), and retirement at 55, disability, retrenchment and leaving India have no wait. Up to 75% of the PF can still be taken at once as a partial withdrawal. Pension withdrawal (Form 10C) now needs 36 months from the last contribution, or reaching retirement age, whichever is earlier (it was 2 months). Not confirmed: whether people who left before 1 July 2026 still get the old 2-month rule.' },
  { id: 'R-DUPLICATE', title: 'Do not file a duplicate claim', applies_to: CLAIM_FORMS,
    body: 'If a claim of the same type is already pending or was recently settled for the same member, a new one will be rejected as a duplicate. Fix: check the claim status first; wait for the pending claim to be settled or rejected before filing again.' },
  // --- info entries ---
  { id: 'R-CONTRIB-SPLIT', title: 'How PF contributions are split', applies_to: ['contribution'], params: { employee_pct: 12, employer_pct: 12, eps_pct: 8.33 }, source: src(`${EPF26}; ${EPS26}; ${WAGE}`),
    body: 'The employee contributes 12% of wages (basic plus DA). The employer also contributes 12%: 8.33% goes to the pension scheme (EPS) on wages up to the wage ceiling, and the rest goes to the provident fund (EPF). A 10% rate still applies to some notified establishments. The ceiling rose to ₹25,000 on 17 September 2026; check the latest EPFO circular for how the pension share is worked out from that date.' },
  { id: 'R-WAGE-CEILING', title: 'Wage ceiling (₹25,000 from 17 Sep 2026)', applies_to: ['contribution'], params: { monthly: 25000 }, source: src(WAGE),
    body: 'The wage ceiling was raised from ₹15,000 to ₹25,000 per month from 17 September 2026. Employees earning up to ₹25,000 must now be covered for PF, pension and EDLI; higher earners may join voluntarily. Existing voluntary members are not affected. EPFO is still rolling out the details, so check the latest circular before advising on contributions.' },
  { id: 'R-EDLI', title: 'EDLI insurance contribution', applies_to: ['contribution', '5IF'], params: { pct: 0.5 }, source: src(EDLI),
    body: "The Employees' Deposit Linked Insurance (EDLI) scheme gives life cover to members. The employer pays 0.5% of wages, up to the wage ceiling; the employee pays nothing. If a member dies in service the nominee gets at least ₹2.5 lakh and at most ₹7 lakh." },
  { id: 'R-ADMIN', title: 'Administrative charges', applies_to: ['contribution'], params: { pct: 0.5, min_monthly: 500 }, source: src(`S.O. 2011(E) dated 21 May 2018, from 1 Jun 2018 (reported: https://conventuslaw.com/report/india-administrative-charges-payable-by-the/); rate under EPF Scheme 2026 para 29 not found`),
    body: 'The employer pays administrative charges of 0.5% of PF wages, with a minimum of ₹500 a month per establishment (₹75 if it has no contributing member). There is no separate EDLI admin charge. The EPF Scheme, 2026 lets the government set this rate; no new rate was found, so confirm before advising.' },
  { id: 'R-DUE-DATE', title: 'Monthly return and payment due date', applies_to: ['contribution'], params: { day: 15 }, source: src(`${EPF26} paras 24, 28, 29; ${CBT238}`),
    body: 'The monthly ECR (electronic challan cum return) must be filed and PF dues paid within 15 days after the month ends, so by the 15th. A late return costs ₹500 a day, up to that month\'s admin charges. Late payment attracts interest and penal damages, and delays can also hold up member claims.' },
  { id: 'R-FORM-19', title: 'Form 19 — final PF settlement', applies_to: ['19'], source: src(`${EPF26} para 49; ${CLARIFY}`),
    body: 'Form 19 is used to withdraw the full provident fund balance (final settlement). From 1 July 2026 this is allowed after 12 months without a job, or straight away on retirement after 55, permanent disability, retrenchment, voluntary retirement or leaving India. Exit date, KYC, bank details and Aadhaar must all be in order.' },
  { id: 'R-FORM-10C', title: 'Form 10C — pension withdrawal benefit or scheme certificate', applies_to: ['10C'], source: src(`${EPS26}; ${CLARIFY}`),
    body: 'Form 10C is used when pension service is under 10 years, either to withdraw the pension (EPS) amount (withdrawal benefit) or to get a scheme certificate that carries the service to the next job. Under the EPS, 2026 the withdrawal benefit is paid only 36 months after the last contribution was due, or on reaching retirement age, whichever is earlier. Taking the money ends pension membership, so a scheme certificate is often better.' },
  { id: 'R-FORM-31', title: 'Form 31 — advance or partial withdrawal', applies_to: ['31'], source: src(`${EPF26} para 46; ${CBT238}`),
    body: 'Form 31 is used to take an advance (partial withdrawal) from PF. Since the EPF Scheme, 2026 there are three types: essential needs (illness, education, marriage), housing, and special circumstances (no reason needed). All need 12 months of membership, and up to the full balance can be taken except a 25% minimum balance.' },
  { id: 'R-FORM-13', title: 'Form 13 — transfer of PF account', applies_to: ['13'], source: src(`${PIB('2094230', '19 Jan 2025')}; ${PIB('2124244', '25 Apr 2025')}`),
    body: 'Form 13 is used to move the PF and pension balance from a previous employer to the current one, so service and money stay together under one UAN. Since January 2025 most online transfer claims go straight to EPFO without employer approval, and since April 2025 the money moves automatically once the old PF office approves it.' },
  { id: 'R-FORM-10D', title: 'Form 10D — monthly pension', applies_to: ['10D'], source: src(`${EPS26}; ${CLARIFY}`),
    body: 'Form 10D is used to claim a monthly pension under EPS: at age 58 after 10 or more years of service, early pension from age 50 (4% less for each year early), disability, or by family members (widow, children, nominee) after the death of a member. Pension can be deferred up to age 60 for 4% more each year.' },
  { id: 'R-FORM-5IF', title: 'Form 5IF — EDLI death claim', applies_to: ['5IF'], source: src(EDLI),
    body: 'Form 5IF is used by the nominee or legal heir to claim the EDLI insurance amount (₹2.5 lakh to ₹7 lakh) when a member dies while in service. It is usually filed along with Form 20 (PF) and Form 10D (pension) for the family.' },
  { id: 'R-PARTIAL-WITHDRAWAL', title: 'Partial withdrawal: purposes, service and limits', applies_to: ['31'], source: src(`${EPF26} para 46; ${CBT238}; ${CLARIFY}`),
    body: 'Partial withdrawals now need 12 months of membership for every purpose. The member keeps 25% of total contributions as a minimum balance and can take up to all of the rest (employee and employer share with interest), at least ₹1,000 each time. Limits: education up to 10 times, marriage 5 times, housing 5 times, special circumstances twice a year. A member out of work can take 75% at once and the rest after 12 months.' },
  { id: 'R-DOCS-CLEAR', title: 'Cheque or passbook image (offline claims only)', applies_to: CLAIM_FORMS, source: src(BANK),
    body: 'Since 3 April 2025 online claims no longer need a cheque or passbook image, because the bank account is verified when it is seeded with the UAN. For paper claims, or if an EPF office asks for proof, the image must be clear and show the member name, account number and IFSC. Fix: send a clear, full image.' },
  { id: 'R-SERVICE-PERIOD', title: 'Service period must meet the requirement', applies_to: ['10C', '10D', '31'], source: src(`${EPS26}; ${EPF26} para 46; ${PIB('2234502', '2 Mar 2026 (239th CBT)')}`),
    body: 'Some claims depend on the length of service. Pension withdrawal (10C) is for pension service under 10 years; monthly pension (10D) needs 10 or more years; every partial withdrawal (31) needs 12 months of membership. In 2024 the old pension scheme was changed to allow a withdrawal benefit even after one month of service; check that the 2026 scheme kept this.' },
  // --- added after the Oct 2026 source check ---
  { id: 'R-AUTO-SETTLEMENT', title: 'Auto-settlement of advance claims up to ₹5 lakh', applies_to: ['31'], source: src(`${PIB('2139291', '24 Jun 2025')}; ${PIB('2227132', '12 Feb 2026')}`),
    body: 'Advance (partial withdrawal) claims up to ₹5 lakh for illness, education, marriage and housing are settled automatically by the system, usually within 3 days, if KYC, Aadhaar and bank details pass the checks. Bigger claims, or ones that fail a check, go to manual processing, which can take up to 20 days.' },
  { id: 'R-TRANSFER', title: 'Previous service must be transferred first', applies_to: CLAIM_FORMS, source: src(`${PIB('2094230', '19 Jan 2025')}; ${PIB('2124244', '25 Apr 2025')}`),
    body: 'Claims are often returned when previous service is still in an old member ID, a transfer-in is pending, there are several member IDs, or the joining and exit dates of two jobs overlap. Since January 2025 most online transfer claims go directly to EPFO without employer approval, and since April 2025 the money moves automatically once the old PF office approves. Fix: complete the transfer (Form 13 or auto-transfer), get overlapping joining or exit dates corrected, then file the claim.' },
  { id: 'R-EPS-PENSION', title: 'Pension (EPS) membership must be right', applies_to: CLAIM_FORMS, source: src('Employees\' Pension (Amendment) Scheme 2014, G.S.R. 609(E) dated 22 Aug 2014, upheld by Supreme Court 4 Nov 2022 (summary: https://nishithdesai.com/research-and-articles/hotline/hr-law-hotline/pension-contributions-for-employees-in-india-recent-developments-8479); ' + EPS26),
    body: 'Pension claims are rejected when the EPS membership is wrong: someone who first joined PF on or after 1 September 2014 with wages above the ceiling (then ₹15,000) is not an EPS member; pension share was paid after age 58; or a higher-wages (joint option) case does not match the records. Fix: the employer corrects the ECR or revises the EPS split, or the member gives a clarification; then file Form 10C or 10D as applicable. Not confirmed: how the ₹25,000 ceiling from 17 Sep 2026 changes this for new joiners.' },
  { id: 'R-CONTRIBUTION', title: 'Contributions must be paid and reconciled', applies_to: CLAIM_FORMS, source: src(`${EPF26} paras 24, 28; ${CBT238}`),
    body: 'A claim can be held or rejected when contributions are missing or not reconciled: gaps in the ECR, a mismatch in the PF ledger, wrong NCP (non-contributing) days, or a recent ECR that is not yet reconciled. The employer must file the monthly ECR and pay within 15 days after the month ends. Fix: the employer files or revises the ECR; wait until it is reconciled and shows in the passbook, then resubmit.' },
  { id: 'R-TDS-PAN', title: 'TDS on PF withdrawal: PAN and Form 121', applies_to: CLAIM_FORMS, source: src(`${PIB('2222490', '3 Feb 2026')} (Income Tax Act, 2025); Form 121 from tax year 2026-27 reported: https://www.etvbharat.com/en/business/epf-withdrawal-tds-exemption-rules-form-121-replaces-15g-slash-15h-from-tax-year-2026-27-enn26101002598`),
    body: 'If PF is withdrawn before 5 years of continuous service, tax (TDS) is cut when the amount is ₹50,000 or more; without PAN it is cut at a much higher rate. From tax year 2026-27 (Income Tax Act, 2025) EPFO accepts Form 121 instead of Form 15G/15H for members whose income is below the taxable limit, and a valid PAN is needed. Fix: seed PAN in the UAN and upload Form 121 if eligible. Not confirmed: whether the ₹50,000 limit is unchanged under the new Act.' },
  { id: 'R-EMPLOYER-CONFIRM', title: 'EPF office may ask for employer confirmation', applies_to: CLAIM_FORMS,
    body: 'For high-value or doubtful claims the EPF office may ask the employer to confirm the member\'s employment, or send a letter saying the claim is genuine. Until that arrives the claim is held or returned. Fix: ask the employer to send the confirmation on letterhead or by email to the regional office, then resubmit the claim.' },
  { id: 'R-JOINT-DECLARATION', title: 'Correcting member details (joint declaration)', applies_to: CLAIM_FORMS, source: src(JD),
    body: "If the UAN is Aadhaar-verified, the member can correct name, date of birth, gender, nationality, father's or mother's name, marital status, spouse name, date of joining and date of leaving on the member portal without any document or approval (since January 2025). For UANs made before 1 October 2017 the employer must certify the change. Members without full e-KYC need employer approval, and some cases still go to EPFO." },
  { id: 'R-UAN-FACE-AUTH', title: 'UAN generation with Aadhaar face authentication', applies_to: ['contribution'], source: src(`${PIB('2120326', '9 Apr 2025')}; ${PIB('2227132', '12 Feb 2026')}`),
    body: 'Since April 2025 a new employee can generate and activate a UAN with Aadhaar face authentication in the UMANG app. Details come straight from Aadhaar, so name, date of birth and father’s name errors are avoided, and the UAN is activated at once. Employers are advised to onboard new joiners this way.' },
  { id: 'R-CLAIM-TIMELINE', title: 'EPFO must settle claims within 20 days', applies_to: CLAIM_FORMS, source: src(`${EPF26} para 54`),
    body: 'Under the EPF Scheme, 2026 a complete claim must be paid within 20 days of EPFO receiving it, and if it is rejected the reason must be told within 20 days. If payment is delayed without reason, 12% yearly penal interest may be charged. Payment is only by electronic transfer to the bank account.' },
];

export async function seedRules(): Promise<number> {
  for (const r of RULES) {
    // Refresh rows the consultant hasn't verified; never touch verified ones. A changed title/body drops the embedding so it is re-embedded.
    await query(
      `insert into rules (id, title, body, applies_to, params, source, last_verified_by) values ($1,$2,$3,$4,$5,$6,null)
       on conflict (id) do update set title = excluded.title, body = excluded.body, applies_to = excluded.applies_to,
         params = excluded.params, source = excluded.source,
         embedding = case when rules.body = excluded.body and rules.title = excluded.title then rules.embedding end
       where rules.last_verified_by is null`,
      [r.id, r.title, r.body, r.applies_to, r.params ? JSON.stringify(r.params) : null, r.source ?? SOURCE],
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

  // Last wage month's salary sheets, mixed statuses; the first employer also has the month before, so anomaly flags show.
  const d = new Date();
  const wageMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const prevMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 2, 1)).toISOString().slice(0, 10);
  const statuses = ['validated', 'paid', 'received'];
  const uploads = employerIds.slice(0, Math.max(0, employerIds.length - 2)); // last two employers: not received yet
  const cols = ['employer_id', 'wage_month', 'rows', 'status'];
  for (const [i, id] of uploads.entries()) {
    const [prev, cur] = makeSalaryMonths(i + 1, 8 + i * 3);
    if (i === 0) await validateSalary((await insert('salary_uploads', { employer_id: id, wage_month: prevMonth, rows: prev, status: 'archived' }, cols))!);
    const uid = await insert('salary_uploads', { employer_id: id, wage_month: wageMonth, rows: i === 0 ? cur : prev, status: statuses[i % 3] }, cols);
    if (statuses[i % 3] !== 'received') await validateSalary(uid!);
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
