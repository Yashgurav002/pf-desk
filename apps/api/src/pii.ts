// PII tokenizer: replaces identifiers with stable tokens ([NAME_1], [UAN_1], ...) before any
// text reaches a model, and restores them afterwards. See PRD §6.3.

export type PiiKind = 'NAME' | 'UAN' | 'AADHAAR' | 'PAN' | 'IFSC' | 'ACC' | 'PHONE' | 'EMAIL' | 'AMT' | 'ID';

const NUMERIC: ReadonlySet<PiiKind> = new Set(['UAN', 'AADHAAR', 'ACC', 'PHONE']);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Pattern order matters: more specific shapes first so a PAN/IFSC/email is never split into
// a digit run, amounts before bare digit runs so "Rs 12,500" stays one AMT.
const PATTERNS: [PiiKind, RegExp][] = [
  ['EMAIL', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ['PAN', /(?<![A-Za-z0-9])[A-Za-z]{5}\d{4}[A-Za-z](?![A-Za-z0-9])/g],
  ['IFSC', /(?<![A-Za-z0-9])[A-Za-z]{4}0[A-Za-z0-9]{6}(?![A-Za-z0-9])/g],
  ['AMT', /(?:₹|(?<![A-Za-z])(?:Rs\.?|INR))\s?\d[\d,]*(?:\.\d+)?/gi],
  ['AADHAAR', /(?<!\d)\d{4}[ -]?\d{4}[ -]?\d{4}(?!\d)/g], // 12 digits; becomes UAN if it matches a known UAN
  ['PHONE', /(?<!\d)(?:\+91[ -]?|0)?[6-9]\d{4}[ -]?\d{5}(?!\d)/g],
  ['ACC', /(?<!\d)\d{9,18}(?!\d)/g],
];

export class Pii {
  private byKey = new Map<string, string>(); // kind:normalised -> token
  private byToken = new Map<string, string>(); // token -> original
  private counts = new Map<PiiKind, number>();
  private known: { kind: PiiKind; value: string }[] = [];

  constructor(known: { kind: PiiKind; value: string }[] = []) {
    for (const k of known) this.add(k.kind, k.value);
  }

  private key(kind: PiiKind, v: string): string {
    if (kind === 'PHONE') return 'PHONE:' + v.replace(/\D/g, '').slice(-10);
    if (NUMERIC.has(kind)) return kind + ':' + v.replace(/\D/g, '');
    return kind + ':' + v.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private token(kind: PiiKind, value: string): string {
    const k = this.key(kind, value);
    let t = this.byKey.get(k);
    if (!t) {
      const n = (this.counts.get(kind) ?? 0) + 1;
      this.counts.set(kind, n);
      t = `[${kind}_${n}]`;
      this.byKey.set(k, t);
      this.byToken.set(t, value.trim());
    }
    return t;
  }

  /** Register a known value (e.g. the employee's name from the DB). Returns its token. */
  add(kind: PiiKind, value: string): string {
    if (!value || !value.trim()) return '';
    if (!this.known.some((k) => this.key(k.kind, k.value) === this.key(kind, value))) this.known.push({ kind, value });
    return this.token(kind, value);
  }

  tokenize(text: string): string {
    let out = text;
    // Known values first, longest first, case-insensitive, whitespace/separator tolerant.
    for (const { kind, value } of [...this.known].sort((a, b) => b.value.length - a.value.length)) {
      const body = NUMERIC.has(kind)
        ? value.replace(/\D/g, '').split('').join('[ -]?')
        : value.trim().split(/\s+/).map(escape).join('\\s+');
      if (!body) continue;
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu');
      out = out.replace(re, () => this.token(kind, value));
    }
    for (const [kind, re] of PATTERNS) {
      out = out.replace(re, (m) => {
        if (kind === 'AADHAAR') {
          const isUan = this.byKey.has(this.key('UAN', m));
          return this.token(isUan ? 'UAN' : 'AADHAAR', m);
        }
        return this.token(kind, m);
      });
    }
    return out;
  }

  detokenize(text: string): string {
    return text.replace(/\[[A-Z]+_\d+\]/g, (t) => this.byToken.get(t) ?? t);
  }
}

export function redact(text: string): string {
  return new Pii().tokenize(text);
}
