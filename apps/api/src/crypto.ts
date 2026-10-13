// Field encryption (AES-256-GCM), HMAC signing, random tokens.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const GEN_HINT = `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`;

function secret(name: string): Buffer {
  const v = process.env[name];
  if (v) {
    const key = Buffer.from(v, 'base64');
    if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded. Generate one with: ${GEN_HINT}`);
    return key;
  }
  if (process.env.DEMO_MODE === 'true') {
    console.warn(`[crypto] ${name} not set — using a fixed DEV key (DEMO_MODE=true). Never use this with real data.`);
    return createHash('sha256').update(`pfdesk-dev-${name}`).digest();
  }
  throw new Error(`${name} is required when DEMO_MODE is not 'true'. Generate one with: ${GEN_HINT} and put it in .env`);
}

let encKey: Buffer | undefined;
let macKey: Buffer | undefined;

export function enc(plain: string | null): string | null {
  if (plain == null) return null;
  encKey ??= secret('APP_ENCRYPTION_KEY');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', encKey, iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url');
}

export function dec(cipher: string | null): string | null {
  if (cipher == null) return null;
  encKey ??= secret('APP_ENCRYPTION_KEY');
  const b = Buffer.from(cipher, 'base64url');
  const d = createDecipheriv('aes-256-gcm', encKey, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

const mac = (payload: string) => {
  macKey ??= secret('HELP_LINK_SECRET');
  return createHmac('sha256', macKey).update(payload).digest();
};

/** Returns `base64url(payload).base64url(hmac)`. */
export function sign(payload: string): string {
  const p = Buffer.from(payload, 'utf8').toString('base64url');
  return `${p}.${mac(p).toString('base64url')}`;
}

/** Returns the original payload, or null if tampered/malformed. */
export function verify(signed: string): string | null {
  const [p, s, extra] = signed.split('.');
  if (!p || !s || extra !== undefined) return null;
  const want = mac(p);
  const got = Buffer.from(s, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  return Buffer.from(p, 'base64url').toString('utf8');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

/** mask('100123456789') -> 'XXXXXXXX6789' */
export function mask(s: string | null, keep = 4): string {
  if (!s) return '';
  return 'X'.repeat(Math.max(0, s.length - keep)) + s.slice(-keep);
}
