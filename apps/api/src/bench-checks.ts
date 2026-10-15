// PRD §20 #4: Pre-check recall on planted errors + false alarms per 100 clean claims (synthetic). -> evaluation/precheck.md
// node src/bench-checks.ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runChecks } from './checks.ts';
import { ERROR_KINDS, makeEmployee } from './synthetic.ts';

const TODAY = '2026-10-15';
const LATER = '2028-01-01'; // past every waiting period, so only planted errors can fire
const CODE: Record<string, string> = {
  name_mismatch: 'NAME', father_name_mismatch: 'FATHER', dob_mismatch: 'DOB', bank_not_verified: 'BANK_NOT_VERIFIED',
  kyc_not_approved: 'KYC', aadhaar_not_linked: 'AADHAAR', ifsc_invalid: 'IFSC', exit_date_missing: 'EXIT',
};
const N = 1000;

const rows: string[] = [];
let tp = 0, total = 0;
for (const kind of ERROR_KINDS) {
  let caught = 0;
  for (let i = 0; i < N / 10; i++) {
    const issues = runChecks(makeEmployee([kind], 10_000 + i, TODAY), { form: '19' }, [], [], LATER);
    if (issues.some((x) => x.code.includes(CODE[kind]))) caught++;
  }
  tp += caught; total += N / 10;
  rows.push(`| ${kind} | ${caught}/${N / 10} |`);
}

let alarms = 0, clean = 0;
const falseCodes = new Map<string, number>();
for (let i = 0; i < N; i++) {
  const issues = runChecks(makeEmployee([], 50_000 + i, TODAY), { form: '19' }, [], [], LATER);
  alarms += issues.length;
  if (!issues.length) clean++;
  for (const x of issues) falseCodes.set(x.code, (falseCodes.get(x.code) ?? 0) + 1);
}

const out = resolve(import.meta.dirname, '../../../evaluation/precheck.md');
writeFileSync(out, `# Pre-check rules (PRD §20 #4)

Updated ${TODAY} · synthetic employees from \`synthetic.ts\` (about 20% of clean names carry a harmless spelling variant — i/ee, v/w, u/oo — or bank-style CAPS that must NOT be flagged). Checked as of ${LATER} so waiting periods don't fire.

**Recall on planted errors: ${tp}/${total} (${(tp / total * 100).toFixed(1)}%)**

| Planted error | Caught |
|---|---|
${rows.join('\n')}

**False alarms on ${N} clean claims: ${(alarms / N * 100).toFixed(1)} per 100 claims** (${N - clean} claims with any flag)${falseCodes.size ? `: ${[...falseCodes].map(([c, n]) => `${c} ×${n}`).join(', ')}` : ''}.

Caveat: the generator and the checks were written by the same team, so this proves the rules fire as designed, not real-world accuracy. Real-world numbers need the consultant's confirmed flags (PRD §3).
`);
console.log(`recall ${tp}/${total}, false alarms ${alarms}/${N}; wrote ${out}`);
