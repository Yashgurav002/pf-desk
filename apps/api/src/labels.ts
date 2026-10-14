// Label tool API (T3.1): consultant labels EPFO rejection remarks for the decoder fine-tune (PRD §15).
// Mounted at /v1/labels behind the consultant login.
import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { query } from './db.ts';
import { redact } from './pii.ts';

type Vocab = { categories: Record<string, { fields: string[]; fix: string[] }>; fields: string[] };
export const VOCAB: Vocab = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../ml/decoder/labels.json'), 'utf8'));
const FIX_IDS = new Set(Object.values(VOCAB.categories).flatMap((c) => c.fix));
const COLS = 'id, text, category, fields_involved, fix_step_ids, source, labelled_by, created_at';

type Label = { text: string; category: string; fields_involved: string[]; fix_step_ids: string[]; source: string; labelled_by: string | null };

/** Validate + normalise one label; returns an error string or the clean row. Text is redacted (no personal data in remarks). */
export function clean(b: any): Label | string {
  const text = typeof b?.text === 'string' ? redact(b.text.trim().replace(/\s+/g, ' ')) : '';
  if (!text) return 'text required';
  const cat = VOCAB.categories[b.category];
  if (!cat) return `unknown category: ${b.category}`;
  const fields: unknown = b.fields_involved ?? cat.fields;
  const fix: unknown = b.fix_step_ids ?? cat.fix;
  if (!Array.isArray(fields) || !Array.isArray(fix)) return 'fields_involved and fix_step_ids must be lists';
  const badField = fields.find((f) => !VOCAB.fields.includes(f));
  if (badField !== undefined) return `unknown field: ${badField}`;
  const badFix = fix.find((f) => !FIX_IDS.has(f));
  if (badFix !== undefined) return `unknown fix step: ${badFix}`;
  return {
    text, category: b.category, fields_involved: [...new Set(fields as string[])], fix_step_ids: [...new Set(fix as string[])],
    source: typeof b.source === 'string' && b.source.trim() ? b.source.trim() : 'consultant',
    labelled_by: typeof b.labelled_by === 'string' && b.labelled_by.trim() ? b.labelled_by.trim() : null,
  };
}

const upsert = async (l: Label) => (await query(`insert into remark_labels (text, category, fields_involved, fix_step_ids, source, labelled_by)
  values ($1,$2,$3,$4,$5,$6) on conflict (text) do update set category = excluded.category, fields_involved = excluded.fields_involved,
  fix_step_ids = excluded.fix_step_ids, source = excluded.source, labelled_by = excluded.labelled_by returning ${COLS}`,
  [l.text, l.category, l.fields_involved, l.fix_step_ids, l.source, l.labelled_by]))[0];

export const labels = new Hono();

labels.get('/', async (c) => {
  const rows = await query(`select ${COLS} from remark_labels order by created_at desc`);
  const counts: Record<string, number> = Object.fromEntries(Object.keys(VOCAB.categories).map((k) => [k, 0]));
  for (const r of rows) counts[r.category] = (counts[r.category] ?? 0) + 1;
  return c.json({ labels: rows, counts, total: rows.length });
});

labels.get('/vocab', (c) => c.json(VOCAB));

labels.get('/queue', async (c) => {
  // Stored text is redacted, so compare on the redacted form. ponytail: scans up to 1000 distinct remarks, paginate if the pool grows past that.
  const rows = await query(`select rejection_remark t, count(*)::int n from claims where coalesce(trim(rejection_remark), '') <> ''
    group by rejection_remark order by n desc limit 1000`);
  const done = new Set((await query('select text from remark_labels')).map((r) => r.text));
  const queue = new Map<string, number>();
  for (const { t, n } of rows) {
    const text = redact(t.trim().replace(/\s+/g, ' '));
    if (!done.has(text)) queue.set(text, (queue.get(text) ?? 0) + n);
  }
  return c.json([...queue].slice(0, 50).map(([text, claim_count]) => ({ text, claim_count })));
});

labels.post('/', async (c) => {
  const l = clean(await c.req.json().catch(() => null));
  if (typeof l === 'string') return c.json({ error: l }, 400);
  return c.json(await upsert(l));
});

labels.get('/export', async (c) => {
  const rows = await query('select text, category, fields_involved, fix_step_ids, source from remark_labels order by created_at');
  return c.body(rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), 200, {
    'content-type': 'application/x-ndjson',
    'content-disposition': 'attachment; filename="remark_labels.jsonl"',
  });
});

labels.post('/import', async (c) => {
  let imported = 0, skipped = 0;
  for (const line of (await c.req.text()).split(/\r?\n/)) {
    if (!line.trim()) continue;
    let l: Label | string;
    try { l = clean(JSON.parse(line)); } catch { l = 'bad json'; }
    if (typeof l === 'string') skipped++;
    else { await upsert(l); imported++; }
  }
  return c.json({ imported, skipped });
});

labels.delete('/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: 'Not found' }, 404);
  const r = await query('delete from remark_labels where id = $1 returning id', [id]);
  return r.length ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404);
});
