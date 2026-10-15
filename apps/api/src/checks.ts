// Deterministic claim pre-checks (PRD §4 F1). Thresholds come from Rule Book params.

export type Severity = 'blocker' | 'warning';
export type Issue = { code: string; severity: Severity; field: string; message: string; fix: string; rule_id: string };
export type EmployeeFacts = {
  name_uan: string | null; name_bank: string | null; name_aadhaar: string | null;
  father_name_uan: string | null; father_name_bank: string | null;
  dob_uan: string | null; dob_aadhaar: string | null; // YYYY-MM-DD
  aadhaar_linked: boolean | null; bank_verified: boolean | null; kyc_approved_by_employer: boolean | null;
  bank_ifsc: string | null; bank_account: string | null; // decrypted
  date_of_joining: string | null; date_of_exit: string | null;
};
export type ClaimFacts = { id?: string; form: string; status?: string };
export type Rule = { id: string; title: string; params: Record<string, any> | null };

// ---------- name matching ----------

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'smt', 'shri', 'shree', 'sri', 'late', 'dr', 'kum', 'km', 'su']);
const ALIASES: Record<string, string> = { mohd: 'mohammed', md: 'mohammed', mohammad: 'mohammed', muhammad: 'mohammed', mohamed: 'mohammed', kr: 'kumar' };

const fold = (t: string) =>
  t.replace(/ph/g, 'f').replace(/w/g, 'v').replace(/ee/g, 'i').replace(/oo/g, 'u')
    .replace(/([^aeiou])h/g, '$1').replace(/(.)\1+/g, '$1');

function tokens(name: string): string[] {
  return name.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((t) => t && !TITLES.has(t))
    .map((t) => fold(ALIASES[t] ?? t));
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Replace single-letter initials in `a` with a not-yet-used full token from `b` starting with that letter. */
function expandInitials(a: string[], b: string[]): string[] {
  const pool = b.filter((t) => t.length > 1 && !a.includes(t));
  return a.map((t) => {
    if (t.length !== 1) return t;
    const i = pool.findIndex((p) => p[0] === t);
    return i < 0 ? t : pool.splice(i, 1)[0];
  });
}

export function nameScore(a: string, b: string): { equal: boolean; score: number } {
  const ta = tokens(a), tb = tokens(b);
  const sa = [...ta].sort().join(' '), sb = [...tb].sort().join(' ');
  if (sa === sb) return { equal: true, score: 1 };
  const ea = expandInitials(ta, tb).sort().join(' '), eb = expandInitials(tb, ta).sort().join(' ');
  if (ea === eb) return { equal: false, score: 0.95 }; // same only once initials are expanded
  return { equal: false, score: 1 - levenshtein(ea, eb) / Math.max(ea.length, eb.length) };
}

// ---------- helpers ----------

const DEFAULTS: Record<string, Record<string, any>> = {
  'R-NAME-MATCH': { block_below: 0.85 },
  'R-FATHER-NAME': { block_below: 0.85 },
  'R-EXIT-DATE': { forms: ['19', '10C', '13'] },
  // EPF Scheme 2026 para 49(2): 12 months; EPS 2026: 36 months. Days rounded up so we never say "file now" a day early.
  'R-WAITING-PERIOD': { days: { '19': 366, '10C': 1096 }, forms: ['19', '10C'] },
  'R-DUPLICATE': { active: ['submitted', 'under_process', 'resubmitted'], settled_forms: ['19', '10C'] },
};
const params = (rules: Rule[], id: string) => ({ ...DEFAULTS[id], ...(rules.find((r) => r.id === id)?.params ?? {}) });

const todayISO = () => new Date().toISOString().slice(0, 10);
const days = (from: string, to: string) => Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);
const months = (from: string, to: string) => Math.max(0, Math.floor(days(from, to) / 30.44));
const fmt = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// ---------- checks ----------

export function runChecks(emp: EmployeeFacts, claim: ClaimFacts, rules: Rule[], otherClaims: ClaimFacts[], today = todayISO()): Issue[] {
  const issues: Issue[] = [];
  const push = (rule_id: string, code: string, severity: Severity, field: string, message: string, fix: string) =>
    issues.push({ code, severity, field, message, fix, rule_id });

  // Names
  const nameRule = params(rules, 'R-NAME-MATCH');
  const namePairs: [string | null, string | null, string, string][] = [
    [emp.name_uan, emp.name_bank, 'bank', 'name_bank'],
    [emp.name_uan, emp.name_aadhaar, 'Aadhaar', 'name_aadhaar'],
  ];
  for (const [u, other, where, field] of namePairs) {
    if (!u || !other) continue;
    const { equal, score } = nameScore(u, other);
    if (equal) continue;
    const severity: Severity = score >= nameRule.block_below ? 'warning' : 'blocker';
    push('R-NAME-MATCH', `NAME_MISMATCH_${where.toUpperCase()}`, severity, field,
      `Name differs: '${u}' (UAN) vs '${other}' (${where}).` + (severity === 'warning' ? ' Looks like the same person, but EPFO may still query it.' : ' EPFO will likely reject this.'),
      where === 'bank'
        ? `Get the bank to correct the account name to match UAN (or correct UAN via joint declaration), then upload a fresh cancelled cheque.`
        : `Correct the name on UAN to match Aadhaar through the member portal / joint declaration, or get Aadhaar updated.`);
  }

  // Father's name
  const fRule = params(rules, 'R-FATHER-NAME');
  if (emp.father_name_uan && emp.father_name_bank) {
    const { equal, score } = nameScore(emp.father_name_uan, emp.father_name_bank);
    if (!equal) {
      const severity: Severity = score >= fRule.block_below ? 'warning' : 'blocker';
      push('R-FATHER-NAME', 'FATHER_NAME_MISMATCH', severity, 'father_name_bank',
        `Father's name differs: '${emp.father_name_uan}' (UAN) vs '${emp.father_name_bank}' (bank).`,
        `Ask the employee which spelling is correct, then fix UAN via joint declaration or get the bank record updated before filing.`);
    }
  }

  // DOB
  if (emp.dob_uan && emp.dob_aadhaar && emp.dob_uan !== emp.dob_aadhaar)
    push('R-DOB', 'DOB_MISMATCH', 'blocker', 'dob_aadhaar',
      `Date of birth differs: ${fmt(emp.dob_uan)} (UAN) vs ${fmt(emp.dob_aadhaar)} (Aadhaar).`,
      `File a DOB correction on the UAN (joint declaration with a birth proof) and wait for approval before submitting the claim.`);

  // Bank
  const ifsc = emp.bank_ifsc?.trim().toUpperCase() ?? '';
  if (!ifsc)
    push('R-IFSC', 'IFSC_MISSING', 'blocker', 'bank_ifsc', `No IFSC code on record for the bank account.`, `Get the IFSC from the employee's cheque or passbook and update bank KYC on the portal.`);
  else if (!IFSC_RE.test(ifsc))
    push('R-IFSC', 'IFSC_INVALID', 'blocker', 'bank_ifsc', `IFSC '${emp.bank_ifsc}' doesn't look right (should be 4 letters, a zero, then 6 letters/digits).`, `Recheck the IFSC on the cancelled cheque and correct the bank KYC.`);

  const acc = emp.bank_account?.replace(/[\s-]/g, '') ?? '';
  if (!acc)
    push('R-BANK-ACCOUNT', 'ACCOUNT_MISSING', 'blocker', 'bank_account', `No bank account number on record.`, `Collect a cancelled cheque or passbook copy and add the bank KYC on the portal.`);
  else if (!/^\d{9,18}$/.test(acc))
    push('R-BANK-ACCOUNT', 'ACCOUNT_INVALID', 'blocker', 'bank_account', `Bank account number has ${acc.length} characters; it should be 9 to 18 digits.`, `Recheck the account number against the cheque/passbook and correct the bank KYC.`);

  if (emp.bank_verified === false)
    push('R-BANK-VERIFIED', 'BANK_NOT_VERIFIED', 'blocker', 'bank_verified', `Bank KYC is not verified yet.`, `Check the bank verification status on the member portal; employer approval isn't needed since Apr 2025. If the bank rejected it, fix the details at the bank and seed it again.`);
  if (emp.kyc_approved_by_employer === false)
    push('R-KYC-EMPLOYER', 'KYC_NOT_APPROVED', 'blocker', 'kyc_approved_by_employer', `Employer hasn't approved the KYC.`, `Log in to the employer portal and approve the pending KYC for this member.`);
  if (emp.aadhaar_linked === false)
    push('R-AADHAAR-LINK', 'AADHAAR_NOT_LINKED', 'blocker', 'aadhaar_linked', `Aadhaar isn't linked to the UAN.`, `Link Aadhaar to UAN (member portal e-KYC or employer seeding) before filing.`);

  // Exit / waiting period
  const exitRule = params(rules, 'R-EXIT-DATE');
  if ((exitRule.forms as string[]).includes(claim.form) && !emp.date_of_exit)
    push('R-EXIT-DATE', 'EXIT_DATE_MISSING', 'blocker', 'date_of_exit', `Form ${claim.form} needs a date of exit, but none is marked.`, `Ask the employer to mark the date of exit on the employer portal (or the member can update the date of leaving on the member portal if the UAN is Aadhaar-verified).`);

  const waitRule = params(rules, 'R-WAITING-PERIOD');
  const need: number | undefined = typeof waitRule.days === 'number' ? waitRule.days : waitRule.days?.[claim.form]; // number or per-form map
  if (need && (waitRule.forms as string[]).includes(claim.form) && emp.date_of_exit) {
    const since = days(emp.date_of_exit, today);
    if (since < need)
      push('R-WAITING-PERIOD', 'WAITING_PERIOD', 'blocker', 'date_of_exit',
        `Left on ${fmt(emp.date_of_exit)}, only ${Math.max(0, since)} days ago; Form ${claim.form} needs ${need} days (about ${Math.round(need / 30.44)} months) after exit.`,
        `Hold the claim until ${fmt(new Date(Date.parse(emp.date_of_exit) + need * 86_400_000).toISOString().slice(0, 10))}, then file.` +
          (claim.form === '19' ? ' If the member needs money now, up to 75% of the PF can be taken as a partial withdrawal (Form 31) [rule R-PARTIAL-WITHDRAWAL].' : ''));
  }

  // Duplicates
  const dupRule = params(rules, 'R-DUPLICATE');
  const dup = otherClaims.find((c) => (!claim.id || c.id !== claim.id) && c.form === claim.form &&
    ((dupRule.active as string[]).includes(c.status ?? '') || (c.status === 'settled' && (dupRule.settled_forms as string[]).includes(c.form))));
  if (dup)
    push('R-DUPLICATE', 'DUPLICATE_CLAIM', 'blocker', 'form',
      `There's already a Form ${dup.form} claim for this member that is ${dup.status?.replace('_', ' ')}.`,
      dup.status === 'settled' ? `Check the passbook; this benefit is already paid out, so don't file again.` : `Wait for the existing claim to settle or be rejected before filing another.`);

  return issues;
}

/** De-identified features matching history_claims columns. -1 = unknown. */
export function features(emp: EmployeeFacts, claim: ClaimFacts, today = todayISO()): Record<string, number | string | boolean> {
  const score = (a: string | null, b: string | null) => (a && b ? nameScore(a, b).score : 1);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    form: claim.form,
    service_months: emp.date_of_joining ? months(emp.date_of_joining, emp.date_of_exit ?? today) : -1,
    name_match: r2(Math.min(score(emp.name_uan, emp.name_bank), score(emp.name_uan, emp.name_aadhaar))),
    father_match: r2(score(emp.father_name_uan, emp.father_name_bank)),
    dob_match: !(emp.dob_uan && emp.dob_aadhaar && emp.dob_uan !== emp.dob_aadhaar),
    bank_verified: emp.bank_verified === true,
    kyc_approved: emp.kyc_approved_by_employer === true,
    aadhaar_linked: emp.aadhaar_linked === true,
    exit_marked: !!emp.date_of_exit,
    months_since_exit: emp.date_of_exit ? months(emp.date_of_exit, today) : -1,
  };
}
