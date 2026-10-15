import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameScore, runChecks, features } from './checks.ts';
import type { Rule } from './checks.ts';
import { ERROR_KINDS, makeEmployee, makeDataset } from './synthetic.ts';
import type { ErrorKind } from './synthetic.ts';

const TODAY = '2026-10-13';
const AFTER_WAIT = '2028-10-13'; // synthetic exits are 70–700 days before TODAY, so all are past the 12-month Form 19 wait by then
const RULES: Rule[] = [{ id: 'R-NAME-MATCH', title: 'Name match', params: { block_below: 0.85 } }];
const EXPECT: Record<ErrorKind, string> = {
  name_mismatch: 'R-NAME-MATCH', father_name_mismatch: 'R-FATHER-NAME', dob_mismatch: 'R-DOB',
  bank_not_verified: 'R-BANK-VERIFIED', kyc_not_approved: 'R-KYC-EMPLOYER', aadhaar_not_linked: 'R-AADHAAR-LINK',
  ifsc_invalid: 'R-IFSC', exit_date_missing: 'R-EXIT-DATE',
};
const FUZZY = new Set(['R-NAME-MATCH', 'R-FATHER-NAME']);

test('nameScore', () => {
  assert.equal(nameScore('Mohd Salim Shaikh', 'Mohammed Salim Shaikh').equal, true);
  assert.equal(nameScore('Shri Praveen Kr. Jadhav', 'PRAVIN KUMAR JADHAV').equal, true);
  const r = nameScore('Ramesh K Patil', 'Ramesh Krishna Patil');
  assert.equal(r.equal, false);
  assert.ok(r.score >= 0.85, `score ${r.score}`);
  assert.ok(nameScore('Ramesh Patil', 'Sunita Deshmukh').score < 0.6);
  assert.ok(nameScore('Anil Gaikwad', 'Fatima Begum Qureshi').score < 0.6);
});

test('20 planted-error cases are all caught with correct severity', () => {
  const cases: ErrorKind[][] = [
    ...ERROR_KINDS.map((k) => [k]), ...ERROR_KINDS.map((k) => [k]),
    ['name_mismatch', 'bank_not_verified'], ['father_name_mismatch', 'dob_mismatch'],
    ['kyc_not_approved', 'aadhaar_not_linked', 'ifsc_invalid'], ['exit_date_missing', 'name_mismatch'],
  ];
  assert.equal(cases.length, 20);
  cases.forEach((planted, i) => {
    const e = makeEmployee(planted, 100 + i, TODAY);
    const issues = runChecks(e, { form: '19' }, RULES, [], AFTER_WAIT);
    for (const k of planted) {
      const hit = issues.find((x) => x.rule_id === EXPECT[k]);
      assert.ok(hit, `case ${i}: ${k} not caught; issues=${JSON.stringify(issues)}`);
      assert.ok(hit.message && hit.fix);
      if (!FUZZY.has(EXPECT[k])) assert.equal(hit.severity, 'blocker');
    }
    // fuzzy ones: severity must follow the threshold
    for (const x of issues.filter((x) => x.rule_id === 'R-NAME-MATCH')) {
      const other = x.field === 'name_bank' ? e.name_bank! : e.name_aadhaar!;
      assert.equal(x.severity, nameScore(e.name_uan!, other).score >= 0.85 ? 'warning' : 'blocker');
    }
    // nothing unplanted fires
    const allowed = new Set(planted.map((k) => EXPECT[k]));
    for (const x of issues) assert.ok(allowed.has(x.rule_id), `case ${i}: unexpected ${x.rule_id}: ${x.message}`);
  });
});

test('clean employees produce no issues', () => {
  for (let s = 0; s < 50; s++) {
    const issues = runChecks(makeEmployee([], 500 + s, TODAY), { form: '19' }, [], [], AFTER_WAIT);
    assert.deepEqual(issues, [], JSON.stringify(issues));
  }
});

test('father message quotes both values', () => {
  const e = { ...makeEmployee([], 1, TODAY), father_name_uan: 'Ramesh K Patil', father_name_bank: 'Ramesh Krishna Patil' };
  const [x] = runChecks(e, { form: '31' }, [], [], TODAY);
  assert.equal(x.message, "Father's name differs: 'Ramesh K Patil' (UAN) vs 'Ramesh Krishna Patil' (bank).");
  assert.equal(x.severity, 'warning');
});

test('waiting period, duplicates, missing bank, rule params', () => {
  const e = { ...makeEmployee([], 2, TODAY), date_of_exit: '2026-09-01' };
  assert.ok(runChecks(e, { form: '19' }, [], [], TODAY).some((x) => x.rule_id === 'R-WAITING-PERIOD'));
  assert.ok(!runChecks(e, { form: '19' }, [{ id: 'R-WAITING-PERIOD', title: '', params: { days: 30 } }], [], TODAY).some((x) => x.rule_id === 'R-WAITING-PERIOD'));
  assert.ok(!runChecks(e, { form: '31' }, [], [], TODAY).some((x) => x.rule_id === 'R-WAITING-PERIOD'));
  // 2026 schemes: Form 19 waits 12 months, Form 10C 36 months
  const wait = (form: string, exit: string) => runChecks({ ...e, date_of_exit: exit }, { form }, [], [], TODAY).some((x) => x.rule_id === 'R-WAITING-PERIOD');
  assert.ok(wait('19', '2025-11-01') && !wait('19', '2025-10-01'));
  assert.ok(wait('10C', '2024-01-01') && !wait('10C', '2023-10-01'));
  assert.ok(!wait('13', '2026-10-01'));

  const ok = makeEmployee([], 3, TODAY);
  const dupe = (others: { id?: string; form: string; status?: string }[]) => runChecks(ok, { id: 'a', form: '19' }, [], others, TODAY).some((x) => x.rule_id === 'R-DUPLICATE');
  assert.ok(dupe([{ id: 'b', form: '19', status: 'under_process' }]));
  assert.ok(dupe([{ id: 'b', form: '19', status: 'settled' }]));
  assert.ok(!dupe([{ id: 'b', form: '19', status: 'rejected' }]));
  assert.ok(!dupe([{ id: 'a', form: '19', status: 'submitted' }]));
  assert.ok(!dupe([{ id: 'b', form: '31', status: 'submitted' }]));

  const missing = runChecks({ ...ok, bank_account: null, bank_ifsc: null, dob_aadhaar: null, name_bank: null }, { form: '19' }, [], [], AFTER_WAIT);
  assert.deepEqual(missing.map((x) => x.code).sort(), ['ACCOUNT_MISSING', 'IFSC_MISSING']);
});

test('features are de-identified', () => {
  const e = makeEmployee(['name_mismatch', 'bank_not_verified'], 9, TODAY);
  const ft = features(e, { form: '19' }, TODAY);
  assert.deepEqual(Object.keys(ft).sort(), ['aadhaar_linked', 'bank_verified', 'dob_match', 'exit_marked', 'father_match', 'form', 'kyc_approved', 'months_since_exit', 'name_match', 'service_months']);
  assert.ok((ft.name_match as number) < 1);
  assert.equal(ft.bank_verified, false);
  const blob = JSON.stringify(ft);
  for (const v of [e.name_uan!, e.bank_account!, e.uan]) assert.ok(!blob.includes(v));
});

test('dataset shape and planted rates', () => {
  const d = makeDataset(42, TODAY);
  assert.equal(d.employers.length, 8);
  assert.equal(d.employees.length, 300);
  assert.equal(d.claims.length, 400);
  assert.equal(d.history.length, 600);
  assert.ok(d.employees.every((e) => /^10\d{10}$/.test(e.uan) && /^\d+$/.test(e.bank_account!)));
  assert.ok(d.claims.filter((c) => c.status === 'rejected').every((c) => c.rejection_remark));
  const rate = (k: ErrorKind) => d.employees.filter((e) => e.planted.includes(k)).length / 300;
  assert.ok(rate('name_mismatch') > 0.06 && rate('name_mismatch') < 0.2);
  const rej = (bad: boolean) => { const h = d.history.filter((r) => (r.bank_verified && r.dob_match && r.aadhaar_linked) !== bad); return h.filter((r) => r.outcome === 'rejected').length / h.length; };
  assert.ok(rej(true) > rej(false) + 0.2, `bad ${rej(true)} vs good ${rej(false)}`);
  assert.deepEqual(makeDataset(42, TODAY).employees[5], d.employees[5]); // deterministic
});
