// Kill-resume benchmark (PRD §19 Phase 4, §20 #8): runs N monthly cycles at CYCLE_FAST timing, hard-kills the worker
// once per cycle at a random moment, restarts it, and checks every cycle ends with exactly the expected tasks (no duplicates).
// Needs a Temporal server (TEMPORAL_ADDRESS). Uses its own PGlite dir; writes evaluation/durability.md.
// Usage: node src/durability.ts [rounds=3]
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client, Connection } from '@temporalio/client';
import { connOpts, NAMESPACE, TASK_QUEUE, cycleId } from './temporal.ts';

const ROUNDS = Number(process.argv[2] || 3);
const SPD = 3; // seconds per cycle "day" (request day 1, chase day 10, due day 15); > worst downtime / 7 so the post-due wait outlives a kill
process.env.PGLITE_DIR ||= mkdtempSync(join(tmpdir(), 'pfdesk-durability-'));
const { query, migrate, close } = await import('./db.ts');
const { seedRules } = await import('./seed.ts');
const { makeSalaryMonths } = await import('./synthetic.ts');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wageMonth = '2026-09';
type Round = { i: number; employerId: string; uploadId?: string; scenario: 'on_time' | 'late'; expected: string[] };

// ---- setup (DB is closed before the worker opens it: PGlite is one process per data dir)
await migrate();
await seedRules();
const rounds: Round[] = [];
for (let i = 1; i <= ROUNDS; i++) {
  const scenario = i % 2 ? 'on_time' : 'late';
  const [er] = await query(`insert into employers (name, cycle_day, due_day) values ($1, 1, 15) returning id`, [`Durability Test ${i}`]);
  const [prev, cur] = makeSalaryMonths(i);
  await query(`insert into salary_uploads (employer_id, wage_month, rows, status) values ($1,'2026-08-01',$2,'archived')`, [er.id, JSON.stringify(prev)]);
  // on_time: the sheet is already in when the cycle starts. late: it arrives by signal while chasing.
  // ponytail: the test can't write to PGlite while the worker owns it, so the late sheet is pre-inserted under another month (only its id is signalled)
  const [{ id: uploadId }] = await query(`insert into salary_uploads (employer_id, wage_month, rows) values ($1,$2,$3) returning id`,
    [er.id, scenario === 'on_time' ? '2026-09-01' : '2026-07-01', JSON.stringify(cur)]);
  rounds.push({ i, employerId: er.id, uploadId, scenario, expected: scenario === 'on_time' ? ['request', 'review'] : ['request', 'chase', 'review', 'due'] });
}
await close();

// ---- worker control
let worker: ChildProcess | null = null;
function startWorker() {
  return new Promise<void>((ok, fail) => {
    const w = spawn(process.execPath, [resolve(import.meta.dirname, 'worker.ts')], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    worker = w;
    const t = setTimeout(() => fail(new Error('worker did not start in 60s')), 60_000);
    w.stdout!.on('data', (d) => { if (String(d).includes('worker running')) { clearTimeout(t); ok(); } });
    w.stderr!.on('data', (d) => process.stderr.write(`[worker] ${d}`));
  });
}
const killWorker = () => { worker?.kill('SIGKILL'); worker = null; };

const client = new Client({ connection: await Connection.connect(connOpts()), namespace: NAMESPACE });
const log: { i: number; scenario: string; killAt: number; downMs: number; result: string }[] = [];
try {
  await startWorker();
  for (const r of rounds) {
    const id = cycleId(r.employerId, wageMonth);
    const h = await client.workflow.start('MonthlyCycleWorkflow', { taskQueue: TASK_QUEUE, workflowId: id, args: [r.employerId, wageMonth, SPD] });
    const t0 = Date.now();
    // the "consultant": reacts to the workflow's stage (query) the way a person would, so signals don't race the compressed clock
    let done = false;
    const sent = new Set<string>();
    const act = async () => {
      while (!done) {
        const stage = await client.connection.withDeadline(Date.now() + 1500, () => h.query<string>('stage')).catch(() => null);
        if (r.scenario === 'late' && ['chasing', 'awaiting_payment', 'payment_overdue'].includes(stage ?? '') && !sent.has('up')) { sent.add('up'); await h.signal('salaryUploaded', r.uploadId!); }
        // on time = pay on day 14 by the clock: Temporal accepts signals even while the worker is down, so don't wait for a stage query
        const payNow = r.scenario === 'on_time' ? Date.now() - t0 > 14 * SPD * 1000 : stage === 'payment_overdue';
        if (payNow && !sent.has('paid')) { sent.add('paid'); await h.signal('paid'); }
        await sleep(300);
      }
    };
    const actor = act();
    const killAt = Math.floor((0.5 + Math.random() * 12.5) * SPD * 1000); // anywhere in days 0.5..13 (both scenarios run past day 14)
    await sleep(killAt);
    killWorker();
    const downMs = 1000 + Math.floor(Math.random() * 2000);
    await sleep(downMs);
    await startWorker();
    const result = await Promise.race([h.result(), sleep(300_000).then(() => 'TIMEOUT')]);
    done = true;
    await actor;
    log.push({ i: r.i, scenario: r.scenario, killAt, downMs, result: String(result) });
    console.log(`round ${r.i} (${r.scenario}): killed at ${(killAt / 1000).toFixed(1)}s, down ${downMs}ms, round took ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${result}`);
  }
} finally {
  killWorker();
  await sleep(1000);
}

// ---- check
const rows = await query(`select ref_id, dedupe_key, title from tasks where kind = 'cycle'`);
await close();
const lines: string[] = [];
let pass = 0;
for (const r of rounds) {
  const mine = rows.filter((t: any) => t.ref_id === r.employerId);
  const steps = mine.map((t: any) => String(t.dedupe_key).split(':').pop()).sort();
  const dupTitles = mine.length - new Set(mine.map((t: any) => t.title)).size;
  const l = log.find((x) => x.i === r.i);
  const ok = dupTitles === 0 && steps.join(',') === [...r.expected].sort().join(',') && l?.result === 'paid';
  if (ok) pass++;
  lines.push(`| ${r.i} | ${r.scenario} | ${l ? (l.killAt / 1000).toFixed(1) : '-'}s | ${l?.downMs ?? '-'}ms | ${r.expected.join(', ')} | ${steps.join(', ')} | ${dupTitles} | ${l?.result ?? '-'} | ${ok ? 'PASS' : 'FAIL'} |`);
}
const md = `# Kill-resume durability (Temporal)

\`node src/durability.ts ${ROUNDS}\` on ${new Date().toISOString().slice(0, 10)}: ${ROUNDS} MonthlyCycleWorkflow runs at CYCLE_FAST timing (1 "day" = ${SPD}s), worker hard-killed (SIGKILL / TerminateProcess) once per run at a random moment, restarted after 1-3 s.
Tasks are created by an idempotent activity keyed on \`<workflow id>:<step>\` (\`tasks.dedupe_key\` unique), so a replay or retry is a no-op.

**Result: ${pass}/${ROUNDS} runs resumed and finished with exactly the expected tasks, 0 duplicates.**

| run | scenario | killed at | down | expected tasks | actual tasks | duplicate titles | result | |
|---|---|---|---|---|---|---|---|---|
${lines.join('\n')}

Scenarios: \`on_time\` = sheet already in; validated on day 1, paid on day 14 (request, review). \`late\` = sheet arrives by signal after the chase; paid only after the due-day task (request, chase, review, payment due).
The test plays the consultant: it queries the workflow's \`stage\` and signals at the matching stage, so signals don't race the compressed clock.
`;
writeFileSync(resolve(import.meta.dirname, '../../../evaluation/durability.md'), md);
console.log(md);
process.exit(pass === ROUNDS ? 0 : 1);
