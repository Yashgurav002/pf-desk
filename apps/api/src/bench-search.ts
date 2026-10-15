// PRD §20 #6: Rule Book search Recall@5 / MRR on 30 questions — keyword vs vector vs hybrid. Needs Ollama (nomic-embed-text).
// node --env-file-if-exists=../../.env src/bench-search.ts  -> evaluation/search.md
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

process.env.PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL;
const { migrate, close } = await import('./db.ts');
const { seedRules, embedMissingRules } = await import('./seed.ts');
const { searchRules } = await import('./search.ts');

// [question as a consultant or member would type it, the rule that answers it]
const Q: [string, string][] = [
  ['Form 10C', 'R-FORM-10C'], ['form 19 final settlement', 'R-FORM-19'], ['Form 31 advance', 'R-FORM-31'],
  ['Form 13 transfer', 'R-FORM-13'], ['5IF death claim', 'R-FORM-5IF'], ['10D monthly pension', 'R-FORM-10D'],
  ['pension withdrawal before 10 years', 'R-FORM-10C'], ['how long after leaving job can I take full PF', 'R-WAITING-PERIOD'],
  ["father's name is different in bank and UAN", 'R-FATHER-NAME'], ['spelling of name differs in aadhaar', 'R-NAME-MATCH'],
  ['date of birth wrong in UAN', 'R-DOB'], ['IFSC code invalid after bank merger', 'R-IFSC'],
  ['bank account not verified by bank', 'R-BANK-VERIFIED'], ['employer has not approved KYC', 'R-KYC-EMPLOYER'],
  ['aadhaar not seeded with UAN', 'R-AADHAAR-LINK'], ['date of exit not marked by employer', 'R-EXIT-DATE'],
  ['same claim already pending', 'R-DUPLICATE'], ['what percent goes to pension fund', 'R-CONTRIB-SPLIT'],
  ['salary above 25000 is PF mandatory', 'R-WAGE-CEILING'], ['EDLI insurance amount for family', 'R-EDLI'],
  ['when is the monthly ECR payment due', 'R-DUE-DATE'], ['admin charges minimum', 'R-ADMIN'],
  ['advance for marriage or house, how much can be taken', 'R-PARTIAL-WITHDRAWAL'], ['auto settlement limit 5 lakh', 'R-AUTO-SETTLEMENT'],
  ['multiple member ids previous company PF not transferred', 'R-TRANSFER'], ['not an EPS member joined after 2014', 'R-EPS-PENSION'],
  ['contribution missing for some months', 'R-CONTRIBUTION'], ['TDS deducted on PF withdrawal PAN', 'R-TDS-PAN'],
  ['correct details through joint declaration', 'R-JOINT-DECLARATION'], ['how many days does EPFO take to settle a claim', 'R-CLAIM-TIMELINE'],
];

await migrate();
await seedRules();
const embedded = await embedMissingRules();
if (!embedded) console.warn('No embeddings (is Ollama running with nomic-embed-text?) — vector numbers will be empty.');

const rows: string[] = [];
const misses: string[] = [];
for (const mode of ['keyword', 'vector', 'hybrid'] as const) {
  let hit = 0, rr = 0;
  for (const [q, want] of Q) {
    const ids = (await searchRules(q, 5, mode)).map((r) => r.id);
    const rank = ids.indexOf(want);
    if (rank >= 0) { hit++; rr += 1 / (rank + 1); } else if (mode === 'hybrid') misses.push(`- "${q}" → wanted ${want}, got ${ids.join(', ') || 'nothing'}`);
  }
  rows.push(`| ${mode} | ${(hit / Q.length * 100).toFixed(0)}% (${hit}/${Q.length}) | ${(rr / Q.length).toFixed(3)} |`);
  console.log(mode, hit, '/', Q.length);
}
await close();

const out = resolve(import.meta.dirname, '../../../evaluation/search.md');
writeFileSync(out, `# Rule Book search (PRD §20 #6)

Updated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${Q.length} questions (in \`apps/api/src/bench-search.ts\`) over the ${embedded || 'un'}-embedded Rule Book seed.
Keyword = Postgres full-text ('simple'); vector = nomic-embed-text + pgvector cosine; hybrid = reciprocal rank fusion (k=60, keyword leg x3 when the query has a form number).

| Search | Recall@5 | MRR |
|---|---|---|
${rows.join('\n')}

Hybrid misses:
${misses.join('\n') || '- none'}
`);
console.log('wrote', out);
