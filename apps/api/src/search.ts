// Hybrid Rule Book search: keyword ('simple' tsvector) + vector (pgvector cosine), fused with RRF k=60.
import { query } from './db.ts';
import { embed } from './llm.ts';

export type RuleRow = {
  id: string; title: string; body: string; applies_to: string[]; params: Record<string, any> | null;
  source: string; last_verified_by: string | null; last_verified_at: string | null;
};

export const RULE_COLS = 'id, title, body, applies_to, params, source, last_verified_by, last_verified_at';
const K = 60;
const LEG = 20; // candidates per leg

export const vecLiteral = (v: number[]) => `[${v.join(',')}]`;

/** Lowercase alnum tokens OR-ed together; '' if nothing searchable. "Form 10C" -> "form | 10c" (matches the '10c' lexeme). */
export const tsQuery = (q: string) => (q.toLowerCase().match(/[a-z0-9]+/g) ?? []).join(' | ');

export async function searchRules(q: string, limit = 5): Promise<(RuleRow & { score: number })[]> {
  const legs: { ids: string[]; w: number }[] = [];
  const tsq = tsQuery(q);
  if (tsq) {
    // Rank by how many distinct query words match first, so a rare "10c" beats many repeats of "form".
    const rows = await query<{ id: string }>(
      `select id from rules, to_tsquery('simple', $1) q where body_tsv @@ q
       order by (select count(*) from unnest($2::text[]) w where body_tsv @@ to_tsquery('simple', w)) desc,
                ts_rank(body_tsv, q) desc, id
       limit ${LEG}`,
      [tsq, [...new Set(tsq.split(' | '))]],
    );
    // Form codes ("10C", "31") are exact terms embeddings don't understand: keyword leg counts triple.
    legs.push({ ids: rows.map((r) => r.id), w: /\d/.test(tsq) ? 3 : 1 });
  }
  const v = q.trim() ? await embed(q, 'query') : null;
  if (v) {
    const rows = await query<{ id: string }>(
      `select id from rules where embedding is not null order by embedding <=> $1::vector, id limit ${LEG}`,
      [vecLiteral(v)],
    );
    legs.push({ ids: rows.map((r) => r.id), w: 1 });
  }

  const scores = new Map<string, number>();
  for (const { ids, w } of legs) ids.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + w / (K + i + 1)));
  const top = [...scores].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (!top.length) return [];

  const rows = await query<RuleRow>(`select ${RULE_COLS} from rules where id = any($1)`, [top.map(([id]) => id)]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return top.flatMap(([id, score]) => (byId.has(id) ? [{ ...byId.get(id)!, score }] : []));
}
