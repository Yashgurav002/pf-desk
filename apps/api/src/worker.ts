// Temporal worker. `pnpm --filter api worker` runs it standalone (Postgres via DATABASE_URL, or its own PGLITE_DIR);
// the API also runs it in-process (runWorkerForever) because embedded PGlite allows one process per data dir.
import { NativeConnection, Worker, Runtime, DefaultLogger } from '@temporalio/worker';
import * as activities from './activities.ts';
import { connOpts, NAMESPACE, TASK_QUEUE } from './temporal.ts';
import { migrate } from './db.ts';
import { join } from 'node:path';

let runtimeInstalled = false;
export async function runWorker() {
  if (!runtimeInstalled) { Runtime.install({ logger: new DefaultLogger('WARN') }); runtimeInstalled = true; }
  const connection = await NativeConnection.connect(connOpts());
  const worker = await Worker.create({
    connection, namespace: NAMESPACE, taskQueue: TASK_QUEUE, activities,
    workflowsPath: join(import.meta.dirname, 'workflows.ts'),
  });
  console.log(`[temporal] worker running on ${connOpts().address} queue=${TASK_QUEUE}`);
  await worker.run();
}

/** Keeps retrying quietly while Temporal is down (logs once). */
export async function runWorkerForever() {
  let warned = false;
  for (;;) {
    try { await runWorker(); return; }
    catch (err) {
      if (!warned) console.warn(`[temporal] worker not started (${(err as Error).message}); retrying every 30s`);
      warned = true;
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }
}

if (process.argv[1] && import.meta.filename === (await import('node:path')).resolve(process.argv[1])) {
  await migrate();
  await runWorker();
}
