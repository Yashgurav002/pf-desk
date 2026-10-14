import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL;

const { query, migrate, close } = await import('./db.ts');
const { labels } = await import('./labels.ts');

const req = (path: string, init?: RequestInit) => labels.request(path, init);
const postJson = (path: string, body: unknown) => req(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

before(async () => {
  await migrate();
  await migrate(); // idempotent
  const [er] = await query(`insert into employers (name) values ('Acme') returning id`);
  const [e] = await query(`insert into employees (employer_id, name_uan) values ($1, 'X') returning id`, [er.id]);
  for (const r of ['FATHER NAME NOT MATCHING', 'FATHER NAME NOT MATCHING', 'Bank a/c 123456789012 not verified', '', null])
    await query(`insert into claims (employee_id, form, status, rejection_remark) values ($1, '19', 'rejected', $2)`, [e.id, r]);
});
after(() => close());

test('vocab served', async () => {
  const v = await (await req('/vocab')).json();
  assert.deepEqual(v.categories.father_name_mismatch.fix, ['R-FATHER-NAME']);
});

test('queue lists distinct non-empty remarks, redacted, with counts', async () => {
  const q = await (await req('/queue')).json();
  assert.equal(q.length, 2);
  assert.deepEqual(q[0], { text: 'FATHER NAME NOT MATCHING', claim_count: 2 });
  assert.ok(!q[1].text.includes('123456789012'), q[1].text);
});

test('post validates, defaults from category, upserts, redacts', async () => {
  assert.equal((await postJson('/', { text: '  ', category: 'other' })).status, 400);
  assert.equal((await postJson('/', { text: 'x', category: 'nope' })).status, 400);
  assert.equal((await postJson('/', { text: 'x', category: 'other', fields_involved: ['shoe'] })).status, 400);
  assert.equal((await postJson('/', { text: 'x', category: 'other', fix_step_ids: ['R-NOPE'] })).status, 400);

  const a = await (await postJson('/', { text: 'FATHER NAME NOT MATCHING', category: 'father_name_mismatch', labelled_by: 'Dad' })).json();
  assert.deepEqual([a.fields_involved, a.fix_step_ids, a.labelled_by], [['father_name'], ['R-FATHER-NAME'], 'Dad']);
  const b = await (await postJson('/', { text: 'FATHER NAME NOT MATCHING', category: 'name_mismatch', fields_involved: [] })).json();
  assert.equal(b.id, a.id); // upsert by text
  assert.deepEqual(b.fields_involved, []);

  const r = await (await postJson('/', { text: 'Bank a/c 123456789012 not verified', category: 'bank_not_verified' })).json();
  assert.ok(!r.text.includes('123456789012'));
  assert.deepEqual(await (await req('/queue')).json(), []); // both labelled (redacted match)

  const all = await (await req('/')).json();
  assert.equal(all.total, 2);
  assert.equal(all.counts.name_mismatch, 1);
  assert.equal(all.counts.dob_mismatch, 0);
});

test('export / import round-trip, delete', async () => {
  const res = await req('/export');
  assert.match(res.headers.get('content-type')!, /ndjson/);
  assert.match(res.headers.get('content-disposition')!, /remark_labels\.jsonl/);
  const body = await res.text();
  assert.equal(body.trim().split('\n').length, 2);
  assert.deepEqual(Object.keys(JSON.parse(body.split('\n')[0])).sort(), ['category', 'fields_involved', 'fix_step_ids', 'source', 'text']);

  const extra = [JSON.stringify({ text: 'DOB MISMATCH', category: 'dob_mismatch', source: 'synthetic' }), '{bad', JSON.stringify({ text: 'y', category: 'zzz' }), ''].join('\n');
  const imp = await (await req('/import', { method: 'POST', body: body + extra })).json();
  assert.deepEqual(imp, { imported: 3, skipped: 2 });
  const all = await (await req('/')).json();
  assert.equal(all.total, 3);
  assert.equal(all.labels.find((l: any) => l.text === 'DOB MISMATCH').source, 'synthetic');

  const id = all.labels[0].id;
  assert.equal((await req(`/${id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await req(`/${id}`, { method: 'DELETE' })).status, 404);
  assert.equal((await req('/abc', { method: 'DELETE' })).status, 404);
});
