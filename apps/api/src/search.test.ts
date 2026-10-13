import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL;
process.env.DEMO_MODE ??= 'true';

const { query, migrate, close } = await import('./db.ts');
const { seedRules, embedMissingRules } = await import('./seed.ts');
const { searchRules } = await import('./search.ts');
const { embed } = await import('./llm.ts');
const { enc, dec, sign, verify, newToken, hashToken, mask } = await import('./crypto.ts');

let embedded = 0;
before(async () => {
  await migrate();
  await migrate(); // idempotent
  await seedRules();
  await seedRules(); // upsert, no duplicates
  embedded = await embedMissingRules();
}, { timeout: 300_000 });
after(() => close());

test('rules seeded, unverified, dates as strings', async () => {
  const rows = await query('select id, source, last_verified_by, params from rules');
  assert.ok(rows.length >= 20);
  assert.ok(rows.every((r) => r.source.includes('VERIFY') && r.last_verified_by === null));
  assert.deepEqual(rows.find((r) => r.id === 'R-WAITING-PERIOD').params, { days: 60, forms: ['19', '10C'] });
  const [{ d }] = await query(`select '2024-03-05'::date d`);
  assert.equal(d, '2024-03-05');
});

test('"Form 10C" found by keyword (top 3)', async () => {
  const ids = (await searchRules('Form 10C')).slice(0, 3).map((r) => r.id);
  assert.ok(ids.includes('R-FORM-10C'), ids.join(','));
  const { tsQuery } = await import('./search.ts');
  assert.equal(tsQuery("Form 10C; drop table--'"), 'form | 10c | drop | table');
  assert.equal(tsQuery('!!'), '');
  await searchRules('!!'); // no keyword leg, must not throw
});

test('"pension withdrawal" found by meaning (top 5)', async (t) => {
  if (!embedded || !(await embed('ping', 'query'))) return t.skip('embedding model unavailable');
  const ids = (await searchRules('pension withdrawal')).map((r) => r.id);
  assert.ok(ids.includes('R-FORM-10C'), ids.join(','));
});

test('crypto: enc/dec, sign/verify, tokens, mask', () => {
  const c = enc('100123456789')!;
  assert.notEqual(c, '100123456789');
  assert.equal(dec(c), '100123456789');
  assert.equal(enc(null), null);
  assert.throws(() => dec(c.slice(0, -2) + (c.endsWith('A') ? 'BB' : 'AA')));
  const s = sign('emp-1|2026-12-31');
  assert.equal(verify(s), 'emp-1|2026-12-31');
  assert.equal(verify(s.slice(0, -1) + (s.endsWith('A') ? 'B' : 'A')), null);
  assert.equal(verify('garbage'), null);
  const { token, hash } = newToken();
  assert.equal(hashToken(token), hash);
  assert.equal(mask('100123456789'), 'XXXXXXXX6789');
});
