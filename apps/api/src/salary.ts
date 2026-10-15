// F5 salary sheet: parse a small employer's sheet and validate one month's PF contributions (PRD §4 F5). Pure functions.
// Rates come from Rule Book params (see ruleParams); nothing is hard-coded here.
import { createHash } from 'node:crypto';

export type SalaryRow = {
  key: string; emp_code: string; uan_masked: string; name: string;
  gross: number | null; epf_wages: number | null; days: number | null; exit_date: string | null; opted_higher: boolean;
};
export type Params = { employee_pct: number; employer_pct: number; eps_pct: number; ceiling: number; edli_pct: number; admin_pct: number; admin_min: number };
export type FlagCode = 'new_joiner' | 'leaver' | 'missing' | 'wage_jump' | 'above_ceiling' | 'zero_or_negative' | 'no_epf_wages';
export type Flag = { code: FlagCode; message: string };

// Forgiving header match: exact alias after normalising, else alias as a prefix ("Gross Salary (Rs)" -> gross).
// Aadhaar / bank account columns are never mapped, so they are never stored.
const COLS: Record<string, string[]> = {
  uan: ['uan', 'uanno', 'uannumber'],
  emp_code: ['empcode', 'employeecode', 'empid', 'employeeid', 'empno', 'staffcode', 'code', 'id'],
  name: ['name', 'employeename', 'membername', 'empname', 'nameofemployee', 'nameofmember'],
  epf_wages: ['epfwages', 'pfwages', 'basicda', 'basicplusda', 'basicandda', 'basicdawages', 'basic'],
  gross: ['gross', 'grosswages', 'grosssalary', 'grosspay', 'totalsalary', 'totalwages', 'salary'],
  days: ['daysworked', 'days', 'presentdays', 'paiddays', 'workingdays', 'payabledays'],
  exit_date: ['dateofexit', 'exitdate', 'doe', 'dateofleaving', 'leavingdate'],
  opted_higher: ['optedhigher', 'higherwages', 'jointoption', 'para266', 'optin', 'highercontribution'],
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export function mapHeaders(headers: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const hs = headers.map(norm);
  for (const pass of ['exact', 'prefix'] as const) {
    hs.forEach((h, i) => {
      if (Object.values(out).includes(i)) return;
      const f = Object.keys(COLS).find((f) => out[f] == null && COLS[f].some((a) => (pass === 'exact' ? h === a : a.length >= 4 && h.startsWith(a))));
      if (f) out[f] = i;
    });
  }
  return out;
}

const num = (v: unknown) => {
  const s = String(v ?? '').replace(/[,₹\s]|rs\.?/gi, '');
  return s === '' || isNaN(Number(s)) ? null : Number(s);
};
const yes = (v: unknown) => /^(y|yes|true|1|haan|ha)$/i.test(String(v ?? '').trim());

/** Sheet rows (header row removed) -> SalaryRow[]. Throws if no employee id or wage column is recognised. */
export function parseSalarySheet(headers: string[], rows: unknown[][]): SalaryRow[] {
  const m = mapHeaders(headers);
  if (m.uan == null && m.emp_code == null && m.name == null) throw new Error(`No UAN, employee code or name column found (columns: ${headers.join(', ')})`);
  if (m.epf_wages == null && m.gross == null) throw new Error(`No wage column found: expected "EPF wages", "Basic+DA" or "Gross" (columns: ${headers.join(', ')})`);
  const get = (r: unknown[], f: string) => (m[f] == null ? '' : String(r[m[f]] ?? '').trim());
  return rows.map((r) => {
    const uan = get(r, 'uan').replace(/\D/g, ''), code = get(r, 'emp_code'), name = get(r, 'name');
    // ponytail: unsalted hash of the UAN as the month-to-month match key; HMAC with APP_ENCRYPTION_KEY if sheets ever leave the laptop
    const key = code ? `code:${code.toUpperCase()}` : uan ? `uan:${createHash('sha256').update(uan).digest('hex').slice(0, 16)}` : `name:${norm(name)}`;
    return {
      key, emp_code: code, uan_masked: uan ? 'X'.repeat(Math.max(0, uan.length - 4)) + uan.slice(-4) : '', name,
      gross: num(get(r, 'gross')), epf_wages: num(get(r, 'epf_wages')), days: num(get(r, 'days')),
      exit_date: get(r, 'exit_date') || null, opted_higher: yes(get(r, 'opted_higher')),
    };
  }).filter((r) => r.name || r.emp_code || r.uan_masked);
}

/** Rule Book rows -> Params. Throws naming the entry when a rate is missing, so nothing silently defaults. */
export function ruleParams(rules: { id: string; params: Record<string, any> | null }[]): Params {
  const p = (id: string, k: string) => {
    const v = rules.find((r) => r.id === id)?.params?.[k];
    if (typeof v !== 'number') throw new Error(`Rule Book entry ${id} has no numeric param "${k}"`);
    return v;
  };
  return {
    employee_pct: p('R-CONTRIB-SPLIT', 'employee_pct'), employer_pct: p('R-CONTRIB-SPLIT', 'employer_pct'), eps_pct: p('R-CONTRIB-SPLIT', 'eps_pct'),
    ceiling: p('R-WAGE-CEILING', 'monthly'), edli_pct: p('R-EDLI', 'pct'), admin_pct: p('R-ADMIN', 'pct'), admin_min: p('R-ADMIN', 'min_monthly'),
  };
}

const rs = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function validateSalary(rows: SalaryRow[], prev: SalaryRow[] | null, p: Params) {
  const r = Math.round; // EPFO rounds each amount to the rupee
  const wagesOf = (x: SalaryRow) => x.epf_wages ?? x.gross ?? 0;
  const before = new Map((prev ?? []).map((x) => [x.key, x]));
  const out = rows.map((x) => {
    const flags: Flag[] = [];
    const wages = wagesOf(x);
    if (x.epf_wages == null) flags.push({ code: 'no_epf_wages', message: 'No Basic+DA / EPF wages given; gross used — confirm the EPF wages' });
    if (wages <= 0 || (x.gross != null && x.gross <= 0) || (x.days != null && x.days < 0)) flags.push({ code: 'zero_or_negative', message: 'Zero or negative wages or days' });
    if (wages > p.ceiling && !x.opted_higher) flags.push({ code: 'above_ceiling', message: `EPF wages ${rs(wages)} above the ${rs(p.ceiling)} ceiling without a higher-wages option — cap at the ceiling or confirm the option` });
    const last = before.get(x.key);
    if (prev && !last) flags.push({ code: 'new_joiner', message: 'New joiner (not in last month\'s sheet) — check UAN and joining date are filed' });
    if (last && wagesOf(last) > 0 && Math.abs(wages - wagesOf(last)) / wagesOf(last) > 0.3)
      flags.push({ code: 'wage_jump', message: `Wages changed ${Math.round(((wages - wagesOf(last)) / wagesOf(last)) * 100)}% vs last month (${rs(wagesOf(last))})` });
    if (x.exit_date) flags.push({ code: 'leaver', message: `Leaver (exit ${x.exit_date}) — mark the date of exit on the portal` });
    const w = Math.max(wages, 0), capped = Math.min(w, p.ceiling);
    const employee = r((w * p.employee_pct) / 100), eps = r((capped * p.eps_pct) / 100);
    const employer_epf = r((w * p.employer_pct) / 100) - eps, edli = r((capped * p.edli_pct) / 100);
    return { key: x.key, emp_code: x.emp_code, uan_masked: x.uan_masked, name: x.name, days: x.days, gross: x.gross, epf_wages: w, eps_wages: capped, employee, eps, employer_epf, edli, flags };
  });
  const seen = new Set(rows.map((x) => x.key));
  const missing = (prev ?? []).filter((x) => !seen.has(x.key)).map((x) => ({
    key: x.key, emp_code: x.emp_code, uan_masked: x.uan_masked, name: x.name,
    flags: [{ code: 'missing' as const, message: `In last month's sheet (${rs(wagesOf(x))}) but missing now — left, or left out?` }],
  }));
  const sum = (k: 'epf_wages' | 'eps_wages' | 'employee' | 'eps' | 'employer_epf' | 'edli') => out.reduce((a, x) => a + x[k], 0);
  const wages = sum('epf_wages');
  const totals = {
    employees: out.length, epf_wages: wages, eps_wages: sum('eps_wages'), employee: sum('employee'), eps: sum('eps'), employer_epf: sum('employer_epf'), edli: sum('edli'),
    admin: Math.max(r((wages * p.admin_pct) / 100), p.admin_min),
    total: 0,
  };
  totals.total = totals.employee + totals.eps + totals.employer_epf + totals.edli + totals.admin;
  const flagged = [...out, ...missing].filter((x) => x.flags.length);
  const counts: Record<string, number> = {};
  for (const x of flagged) for (const f of x.flags) counts[f.code] = (counts[f.code] ?? 0) + 1;
  const summary = `${out.length} employees, EPF wages ${rs(wages)}, total payable ${rs(totals.total)}. ` +
    (flagged.length ? `${flagged.length} to review: ${Object.entries(counts).map(([k, n]) => `${n} ${k.replaceAll('_', ' ')}`).join(', ')}.` : 'No anomalies.');
  return { rows: out, missing, totals, params: p, flag_count: flagged.length, counts, summary, compared_with_previous: !!prev };
}
export type Validation = ReturnType<typeof validateSalary>;
