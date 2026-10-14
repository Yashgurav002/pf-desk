// Writes de-identified history_claims to ml/tabpfn/history.csv for the TabPFN evaluation (no names, IDs or amounts exist in this table).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { query, migrate, close } from './db.ts';

await migrate();
const rows = await query('select * from history_claims order by submitted_at, id');
const cols = Object.keys(rows[0] ?? {}).filter((c) => c !== 'id');
const cell = (v: unknown) => (v == null ? '' : String(v).includes(',') ? `"${v}"` : String(v));
const out = resolve(import.meta.dirname, '../../../ml/tabpfn/history.csv');
writeFileSync(out, [cols.join(','), ...rows.map((r: any) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n');
console.log(`wrote ${rows.length} rows to ${out}`);
await close();
