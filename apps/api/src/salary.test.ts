import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSalarySheet, ruleParams, validateSalary, mapHeaders } from './salary.ts';

// test-only rates (the app reads them from the Rule Book)
const P = ruleParams([
  { id: 'R-CONTRIB-SPLIT', params: { employee_pct: 12, employer_pct: 12, eps_pct: 8.33 } },
  { id: 'R-WAGE-CEILING', params: { monthly: 15000 } },
  { id: 'R-EDLI', params: { pct: 0.5 } },
  { id: 'R-ADMIN', params: { pct: 0.5, min_monthly: 500 } },
]);

const H = ['Emp Code', 'UAN No.', 'Employee Name', 'Gross Salary (Rs)', 'Basic + DA', 'Days Worked', 'Aadhaar No', 'Bank A/c No'];
const sheet = (rows: unknown[][]) => parseSalarySheet(H, rows);

test('forgiving headers; Aadhaar and account columns are never kept', () => {
  const m = mapHeaders(H);
  assert.deepEqual([m.emp_code, m.uan, m.name, m.gross, m.epf_wages, m.days], [0, 1, 2, 3, 4, 5]);
  const [r] = sheet([['E1', '100123456789', 'Ramesh Kumar', '20,000', '12000', '26', '123412341234', '5555666677778888']]);
  assert.equal(r.uan_masked, 'XXXXXXXX6789');
  const s = JSON.stringify(r);
  assert.ok(!s.includes('123412341234') && !s.includes('5555666677778888') && !s.includes('100123456789'));
  assert.equal(r.gross, 20000);
});

test('contribution split, EPS cap, EDLI, admin minimum', () => {
  const v = validateSalary(sheet([['E1', '', 'A', '20000', '12000', '26'], ['E2', '', 'B', '30000', '20000', '26']]), null, P);
  const [a, b] = v.rows;
  assert.deepEqual([a.employee, a.eps, a.employer_epf, a.edli], [1440, 1000, 440, 60]); // 12000*8.33% = 999.6 -> 1000
  assert.equal(b.eps_wages, 15000);
  assert.deepEqual([b.employee, b.eps, b.employer_epf, b.edli], [2400, 1250, 1150, 75]);
  assert.equal(v.totals.admin, 500); // 0.5% of 32000 = 160 < minimum
  assert.equal(v.totals.total, 1440 + 1000 + 440 + 60 + 2400 + 1250 + 1150 + 75 + 500);
  assert.deepEqual(b.flags.map((f) => f.code), ['above_ceiling']);
});

test('anomalies vs last month', () => {
  const prev = sheet([['E1', '', 'A', '12000', '10000', '26'], ['E2', '', 'B', '12000', '10000', '26'], ['E3', '', 'C', '9000', '8000', '26']]);
  const cur = parseSalarySheet([...H.slice(0, 6), 'Date of Exit'], [
    ['E1', '', 'A', '18000', '14000', '26', ''],      // +40%
    ['E2', '', 'B', '12000', '10000', '20', '2026-09-20'], // leaver
    ['E4', '', 'D', '0', '0', '0', ''],                // new joiner with zero wages
  ]);
  const v = validateSalary(cur, prev, P);
  const codes = Object.fromEntries(v.rows.map((r) => [r.emp_code, r.flags.map((f) => f.code)]));
  assert.deepEqual(codes, { E1: ['wage_jump'], E2: ['leaver'], E4: ['zero_or_negative', 'new_joiner'] });
  assert.deepEqual(v.missing.map((m) => m.emp_code), ['E3']);
  assert.equal(v.flag_count, 4);
  assert.match(v.summary, /4 to review/);
});

test('missing rate in the Rule Book is an error, not a silent default', () => {
  assert.throws(() => ruleParams([{ id: 'R-EDLI', params: { pct: 0.5 } }]), /R-CONTRIB-SPLIT/);
  assert.throws(() => parseSalarySheet(['Name', 'Days'], [['A', '1']]), /No wage column/);
});
