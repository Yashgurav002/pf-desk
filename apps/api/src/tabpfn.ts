// Client for ml/tabpfn/serve.py. Sends only de-identified feature columns (PRD §6.4); returns null when the service is down so callers fall back to baselines.
import { query } from './db.ts';
import { span } from './sentry.ts';

const URL = process.env.TABPFN_URL || 'http://127.0.0.1:8790';
export const FEATURE_COLS = ['form', 'service_months', 'age_band', 'employer_size_band', 'name_match', 'father_match', 'dob_match',
  'bank_verified', 'kyc_approved', 'aadhaar_linked', 'exit_marked', 'months_since_exit', 'submit_month', 'office_code'] as const;
export type FeatureRow = Record<(typeof FEATURE_COLS)[number], string | number | boolean>;

let warned = false;
async function predict(task: 'risk' | 'eta', train: unknown[], rows: FeatureRow[]): Promise<any | null> {
  try {
    const r = await span(`tabpfn.${task}`, 'ml.predict', { train_rows: train.length, rows: rows.length }, () => fetch(`${URL}/predict`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task, train, rows: rows.map((row) => Object.fromEntries(FEATURE_COLS.map((c) => [c, row[c]]))) }),
      signal: AbortSignal.timeout(90_000),
    }));
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return await r.json();
  } catch (err) {
    if (!warned) { console.warn(`TabPFN service unavailable (${(err as Error).message}); using baselines`); warned = true; }
    return null;
  }
}

// ordered by id so the payload hash (the service's fit cache key) is stable between calls
const trainRows = (where: string, target: string) =>
  query(`select ${FEATURE_COLS.join(', ')}, ${target} from history_claims ${where} order by id`);

export async function tabpfnRisk(row: FeatureRow) {
  const out = await predict('risk', await trainRows('', 'outcome'), [row]);
  return out ? { pct: out.p_reject[0] as number, model: out.model as string } : null;
}
export async function tabpfnEta(row: FeatureRow) {
  const out = await predict('eta', await trainRows(`where outcome = 'settled'`, 'days_to_outcome'), [row]);
  return out ? { days: out.p50[0] as number, low: out.p20[0] as number, high: out.p80[0] as number, model: out.model as string } : null;
}

export const ageBand = (dob: string | null, today: string) => {
  if (!dob) return 'unknown';
  const age = (Date.parse(today) - Date.parse(dob)) / (365.25 * 864e5);
  return age < 26 ? '18-25' : age < 36 ? '26-35' : age < 46 ? '36-45' : age < 58 ? '46-57' : '58+';
};
export const sizeBand = (n: number) => (n < 20 ? '<20' : n < 50 ? '20-49' : n < 100 ? '50-99' : '100+');
