// Synthetic PF data (PRD §10.3). Clearly fake: Faker en_IN, seeded, never derived from real people.
import { Faker, en_IN, en } from '@faker-js/faker';
import { features, nameScore } from './checks.ts';
import type { EmployeeFacts } from './checks.ts';

export const ERROR_KINDS = ['name_mismatch', 'father_name_mismatch', 'dob_mismatch', 'bank_not_verified', 'kyc_not_approved', 'aadhaar_not_linked', 'ifsc_invalid', 'exit_date_missing'] as const;
export type ErrorKind = typeof ERROR_KINDS[number];

export type SyntheticEmployee = EmployeeFacts & {
  uan: string; phone: string; aadhaar_last4: string; pan_present: boolean;
  preferred_language: 'hi' | 'mr' | 'en'; planted: ErrorKind[];
};

// Rates used by makeDataset (exit_date_missing applies only to exited employees).
const RATES: Record<ErrorKind, number> = {
  name_mismatch: 0.12, father_name_mismatch: 0.08, dob_mismatch: 0.05, bank_not_verified: 0.06,
  kyc_not_approved: 0.05, aadhaar_not_linked: 0.04, ifsc_invalid: 0.02, exit_date_missing: 0.1,
};

export const REMARKS: { text: string; category: string }[] = [
  { text: 'NAME MISMATCH WITH BANK A/C', category: 'name_mismatch' },
  { text: 'Member name not matching as per bank records', category: 'name_mismatch' },
  { text: 'NAME OF MEMBER DIFFERS IN UAN & AADHAAR', category: 'name_mismatch' },
  { text: 'name in cheque leaf not legible/not matching', category: 'name_mismatch' },
  { text: "FATHER'S NAME MISMATCH", category: 'father_name_mismatch' },
  { text: 'Father/husband name not as per records. pls correct thru JD', category: 'father_name_mismatch' },
  { text: 'F/NAME DIFFERS IN BANK & EPFO RECORD', category: 'father_name_mismatch' },
  { text: 'DOB MISMATCH AS PER AADHAAR', category: 'dob_mismatch' },
  { text: 'Date of birth not matching with UIDAI data', category: 'dob_mismatch' },
  { text: 'D.O.B. DIFFERENT IN CLAIM & MEMBER PROFILE', category: 'dob_mismatch' },
  { text: 'INVALID IFSC CODE', category: 'bank_details_invalid' },
  { text: 'Bank a/c no. incorrect / a/c closed. Submit correct details', category: 'bank_details_invalid' },
  { text: 'BANK ACCOUNT INACTIVE/FROZEN', category: 'bank_details_invalid' },
  { text: 'BANK KYC NOT VERIFIED', category: 'bank_not_verified' },
  { text: 'Bank details not verified by bank. Pls get verified', category: 'bank_not_verified' },
  { text: 'BANK A/C PENDING FOR VERIFICATION AT BANK END', category: 'bank_not_verified' },
  { text: 'CHEQUE IMAGE NOT CLEAR', category: 'cheque_image_unclear' },
  { text: 'uploaded cheque/passbook blurred, a/c no & IFSC not visible', category: 'cheque_image_unclear' },
  { text: 'CANCELLED CHQ NOT LEGIBLE PL RESUBMIT', category: 'cheque_image_unclear' },
  { text: 'KYC NOT APPROVED BY EMPLOYER', category: 'kyc_not_approved' },
  { text: 'Pending KYC at employer level', category: 'kyc_not_approved' },
  { text: 'AADHAAR NOT SEEDED WITH UAN', category: 'aadhaar_not_linked' },
  { text: 'Aadhaar not verified/linked. UIDAI verification failed', category: 'aadhaar_not_linked' },
  { text: 'DOE NOT AVAILABLE', category: 'exit_date_missing' },
  { text: 'Date of exit not updated by establishment', category: 'exit_date_missing' },
  { text: 'DT OF LEAVING NOT MARKED IN SERVICE HISTORY', category: 'exit_date_missing' },
  { text: 'SERVICE LESS THAN REQUIRED FOR WITHDRAWAL', category: 'service_ineligible' },
  { text: 'Member not eligible as per para 68 - service insufficient', category: 'service_ineligible' },
  { text: 'NOT ELIGIBLE: 2 MONTHS NOT COMPLETED FROM DOE', category: 'waiting_period' },
  { text: 'claim filed before completion of waiting period', category: 'waiting_period' },
  { text: 'PURPOSE NOT ADMISSIBLE', category: 'purpose_ineligible' },
  { text: 'Advance purpose not covered / documents for purpose not attached', category: 'purpose_ineligible' },
  { text: 'CLAIM ALREADY SETTLED', category: 'duplicate_claim' },
  { text: 'Duplicate claim. Earlier claim under process', category: 'duplicate_claim' },
  { text: 'SAME CLAIM ALREADY SUBMITTED - REJECTED AS DUPLICATE', category: 'duplicate_claim' },
  { text: 'SIGNATURE NOT MATCHING', category: 'signature_or_photo' },
  { text: 'Photo not clear / signature missing on form', category: 'signature_or_photo' },
  { text: 'MEMBER DETAILS NOT FOUND, CONTACT ESTT', category: 'other' },
  { text: 'Rejected. Refer to estt for clarification', category: 'other' },
  { text: 'PL SUBMIT FRESH CLAIM WITH CORRECT DETAILS', category: 'other' },
];

const PLANT_CATEGORY: Record<ErrorKind, string> = {
  name_mismatch: 'name_mismatch', father_name_mismatch: 'father_name_mismatch', dob_mismatch: 'dob_mismatch',
  bank_not_verified: 'bank_not_verified', kyc_not_approved: 'kyc_not_approved', aadhaar_not_linked: 'aadhaar_not_linked',
  ifsc_invalid: 'bank_details_invalid', exit_date_missing: 'exit_date_missing',
};

const BANKS: [string, number][] = [['SBIN', 11], ['HDFC', 14], ['ICIC', 12], ['UTIB', 15], ['BARB', 14], ['BKID', 15], ['MAHB', 11], ['PUNB', 16], ['CNRB', 13], ['KKBK', 10]];
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const newFaker = (seed: number) => new Faker({ locale: [en_IN, en], seed });

/** Mutation that a real consultant would call a mismatch (never folded away by nameScore). */
function mismatch(f: Faker, name: string): string {
  const parts = name.split(' ');
  for (let tries = 0; tries < 20; tries++) {
    const kind = f.number.int({ min: 0, max: 2 });
    let out: string;
    if (kind === 0 && parts.length > 2) out = [parts[0], parts[parts.length - 1]].join(' '); // drop middle name
    else if (kind === 1) { const i = f.number.int({ min: 0, max: parts.length - 2 }); out = parts.map((p, j) => (j === i ? p[0] : p)).join(' '); } // initial
    else { // single-character typo
      const i = f.number.int({ min: 1, max: name.length - 1 });
      if (name[i] === ' ') continue;
      out = name.slice(0, i) + f.helpers.arrayElement('abdegklmnrstuy'.split('').filter((c) => c !== name[i].toLowerCase())) + name.slice(i + 1);
    }
    if (!nameScore(name, out).equal) return out;
  }
  return parts.slice(1).join(' ') + ' X';
}

/** Harmless spelling variant (i<->ee, v<->w, u<->oo) or bank-style CAPS; nameScore treats it as equal. */
function variant(f: Faker, name: string): string {
  const r = f.number.int({ min: 0, max: 3 });
  if (r === 0) return name.toUpperCase();
  if (r === 1 && /ee/.test(name)) return name.replace('ee', 'i');
  if (r === 1 && /i/.test(name)) return name.replace('i', 'ee');
  if (r === 2 && /v/i.test(name)) return name.replace(/v/, 'w').replace(/^V/, 'W');
  if (r === 3 && /oo/.test(name)) return name.replace('oo', 'u');
  return name.toUpperCase();
}

function genEmployee(f: Faker, planted: ErrorKind[], today: string, exited: boolean): SyntheticEmployee {
  const has = (k: ErrorKind) => planted.includes(k);
  const last = f.person.lastName();
  const father = f.person.firstName('male');
  const grandfather = f.person.firstName('male');
  const name = `${f.person.firstName()} ${father} ${last}`; // Maharashtrian style: middle = father's first name
  const fatherName = `${father} ${grandfather} ${last}`;
  const ref = Date.parse(today);

  const dob = iso(f.date.between({ from: Date.parse('1966-01-01'), to: Date.parse('2003-12-31') }).getTime());
  const exit = iso(ref - f.number.int({ min: 70, max: 700 }) * DAY);
  const doj = iso(Date.parse(exited ? exit : today) - f.number.int({ min: 8, max: 180 }) * 30 * DAY);
  const [bank, len] = f.helpers.arrayElement(BANKS);
  let ifsc = `${bank}0${f.string.alphanumeric({ length: 6, casing: 'upper' })}`;
  if (has('ifsc_invalid')) ifsc = f.datatype.boolean() ? ifsc.slice(0, 4) + 'O' + ifsc.slice(5) : ifsc.slice(0, 10);

  const pick = <T>(p: number, a: T, b: T) => (f.datatype.boolean({ probability: p }) ? a : b);
  let name_bank = pick(0.2, variant(f, name), name), name_aadhaar = name;
  if (has('name_mismatch')) { if (f.datatype.boolean()) name_bank = mismatch(f, name); else name_aadhaar = mismatch(f, name); }
  const father_name_bank = has('father_name_mismatch') ? mismatch(f, fatherName) : pick(0.15, variant(f, fatherName), fatherName);

  let dob_aadhaar = dob;
  if (has('dob_mismatch')) {
    const [y, m, d] = dob.split('-');
    dob_aadhaar = Number(d) <= 12 && d !== m ? `${y}-${d}-${m}` : iso(Date.parse(dob) + f.number.int({ min: 1, max: 400 }) * DAY * (f.datatype.boolean() ? 1 : -1));
  }

  return {
    name_uan: name, name_bank, name_aadhaar,
    father_name_uan: fatherName, father_name_bank,
    dob_uan: dob, dob_aadhaar,
    aadhaar_linked: !has('aadhaar_not_linked'),
    bank_verified: !has('bank_not_verified'),
    kyc_approved_by_employer: !has('kyc_not_approved'),
    bank_ifsc: ifsc,
    bank_account: f.string.numeric({ length: len, allowLeadingZeros: false }),
    date_of_joining: doj,
    date_of_exit: exited && !has('exit_date_missing') ? exit : null,
    uan: '10' + f.string.numeric(10),
    phone: f.helpers.arrayElement(['6', '7', '8', '9']) + f.string.numeric(9),
    aadhaar_last4: f.string.numeric(4),
    pan_present: f.datatype.boolean({ probability: 0.85 }),
    preferred_language: f.helpers.weightedArrayElement([{ value: 'hi' as const, weight: 4 }, { value: 'mr' as const, weight: 4 }, { value: 'en' as const, weight: 2 }]),
    planted: [...planted],
  };
}

/** One exited employee (exit 70–700 days ago) with exactly the given errors planted. */
export function makeEmployee(planted: ErrorKind[] = [], seed = 1, today = todayISO()): SyntheticEmployee {
  return genEmployee(newFaker(seed), planted, today, true);
}

const plantAtRates = (f: Faker, exited: boolean) =>
  ERROR_KINDS.filter((k) => (k !== 'exit_date_missing' || exited) && f.datatype.boolean({ probability: RATES[k] }));

const EMPLOYER_NAMES = ['Sai Krupa Engineering Works', 'Shree Ganesh Plastics', 'Vasai Fab Industries', 'Palghar Agro Foods', 'Om Packaging Industries', 'Jai Ambe Garments', 'Sahyadri Tool Room', 'Navkar Logistics'];
const OFFICES = ['MHBAN', 'MHKND', 'MHTHA', 'MHVAS'];
const OFFICE_DELAY: Record<string, number> = { MHBAN: 0, MHKND: 3, MHTHA: 5, MHVAS: 8 };
const FORM_DAYS: Record<string, number> = { '19': 12, '10C': 15, '31': 7, '13': 18 };
const PURPOSES = ['illness', 'marriage', 'education', 'house construction', 'housing loan repayment'];
const GENERIC = ['cheque_image_unclear', 'service_ineligible', 'signature_or_photo', 'other'];

export function makeDataset(seed = 42, today = todayISO()) {
  const f = newFaker(seed);
  const ref = Date.parse(today);

  const employers = EMPLOYER_NAMES.map((name, i) => ({
    name,
    establishment_code: OFFICES[i % OFFICES.length] + f.string.numeric(7) + '000',
    contact_name: `${f.person.firstName()} ${f.person.lastName()}`,
    contact_phone: f.helpers.arrayElement(['7', '8', '9']) + f.string.numeric(9),
    cycle_day: 1,
    due_day: 15,
  }));

  const employees = Array.from({ length: 300 }, () => {
    const exited = f.datatype.boolean({ probability: 0.55 });
    return { ...genEmployee(f, plantAtRates(f, exited), today, exited), employer_idx: f.number.int({ min: 0, max: employers.length - 1 }) };
  });

  const claims = Array.from({ length: 400 }, () => {
    const employee_idx = f.number.int({ min: 0, max: employees.length - 1 });
    const e = employees[employee_idx];
    const exited = e.date_of_exit !== null || e.planted.includes('exit_date_missing');
    const form = exited ? f.helpers.weightedArrayElement([{ value: '19', weight: 5 }, { value: '10C', weight: 3 }, { value: '13', weight: 2 }]) : f.helpers.weightedArrayElement([{ value: '31', weight: 4 }, { value: '13', weight: 1 }]);
    const bad = e.planted.length > 0;
    const status = f.helpers.weightedArrayElement([
      { value: 'draft', weight: 15 }, { value: 'checked', weight: 10 }, { value: 'submitted', weight: 20 },
      { value: 'under_process', weight: 15 }, { value: 'settled', weight: bad ? 10 : 30 }, { value: 'rejected', weight: bad ? 35 : 5 },
    ]);
    const created = ref - f.number.int({ min: 0, max: 90 }) * DAY;
    const submitted = ['draft', 'checked'].includes(status) ? null : Math.min(ref, created + f.number.int({ min: 0, max: 5 }) * DAY);
    const outcome = submitted === null ? null : Math.min(ref, submitted + f.number.int({ min: 7, max: 30 }) * DAY);
    let rejection_remark: string | null = null;
    if (status === 'rejected') {
      const cats = e.planted.map((k) => PLANT_CATEGORY[k]);
      const pool = REMARKS.filter((r) => cats.includes(r.category));
      rejection_remark = f.helpers.arrayElement(pool.length ? pool : REMARKS).text;
    }
    return {
      employee_idx, form, status,
      purpose: form === '31' ? f.helpers.arrayElement(PURPOSES) : null,
      created_at: iso(created),
      submitted_at: submitted === null ? null : iso(submitted),
      settled_at: status === 'settled' && outcome !== null ? iso(outcome) : null,
      rejected_at: status === 'rejected' && outcome !== null ? iso(outcome) : null,
      rejection_remark,
    };
  });

  // Rejection weight per failed flag; P(reject) = 1 - 0.93 * Π(1 - w).
  const W: [ErrorKind, number][] = [['exit_date_missing', 0.6], ['bank_not_verified', 0.6], ['aadhaar_not_linked', 0.55], ['dob_mismatch', 0.5], ['kyc_not_approved', 0.5], ['name_mismatch', 0.5], ['father_name_mismatch', 0.4], ['ifsc_invalid', 0.4]];
  const history = Array.from({ length: 600 }, () => {
    const form = f.helpers.weightedArrayElement([{ value: '19', weight: 4 }, { value: '10C', weight: 3 }, { value: '31', weight: 4 }, { value: '13', weight: 2 }]);
    const exited = form !== '31';
    const e = genEmployee(f, plantAtRates(f, exited), today, exited);
    const feat = features(e, { form }, today);
    const failed = W.filter(([k]) => e.planted.includes(k));
    const pReject = 1 - 0.93 * failed.reduce((p, [, w]) => p * (1 - w), 1);
    const rejected = f.datatype.boolean({ probability: pReject });
    const office = f.helpers.arrayElement(OFFICES);
    const age = Math.floor((ref - Date.parse(e.dob_uan!)) / (365.25 * DAY));
    // spread over ~18 months so the TabPFN eval can split by time (train older, test newer)
    const submitted = ref - f.number.int({ min: 40, max: 540 }) * DAY;
    const month = new Date(submitted).getUTCMonth() + 1;
    const yearEnd = month === 3 || month === 4 ? 4 : 0; // synthetic: financial-year-end backlog
    return {
      form,
      service_months: feat.service_months as number,
      age_band: age < 26 ? '18-25' : age < 36 ? '26-35' : age < 46 ? '36-45' : age < 58 ? '46-57' : '58+',
      employer_size_band: f.helpers.arrayElement(['<20', '20-49', '50-99', '100+']),
      name_match: feat.name_match as number,
      father_match: feat.father_match as number,
      dob_match: feat.dob_match as boolean,
      bank_verified: feat.bank_verified as boolean,
      kyc_approved: feat.kyc_approved as boolean,
      aadhaar_linked: feat.aadhaar_linked as boolean,
      exit_marked: feat.exit_marked as boolean,
      months_since_exit: feat.months_since_exit as number,
      submitted_at: iso(submitted),
      submit_month: month,
      office_code: office,
      outcome: rejected ? 'rejected' as const : 'settled' as const,
      days_to_outcome: Math.max(5, Math.min(35, FORM_DAYS[form] + OFFICE_DELAY[office] + yearEnd + f.number.int({ min: -4, max: 6 }) - (rejected ? 3 : 0))),
      rejection_category: rejected ? (failed.length ? PLANT_CATEGORY[failed[0][0]] : f.helpers.arrayElement(GENERIC)) : null,
    };
  });

  return { employers, employees, claims, history };
}

