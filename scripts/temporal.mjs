// `pnpm dev` hook: Temporal dev server (`temporal server start-dev`) on :7233, UI on :8233, state in .data/temporal.db.
// Uses .tools/temporal(.exe) or `temporal` on PATH; skips quietly if neither exists or something already listens on the port.
// The worker runs inside the API process (see apps/api/src/worker.ts).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { connect } from 'node:net';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const local = resolve(root, '.tools', process.platform === 'win32' ? 'temporal.exe' : 'temporal');
const bin = existsSync(local) ? local : spawnSync('temporal', ['--version']).status === 0 ? 'temporal' : null;
if (!bin) {
  console.warn('[temporal] CLI not found (PATH or .tools/) — monthly cycles run without Temporal. https://docs.temporal.io/cli');
  process.exit(0);
}
const addr = new URL(`http://${process.env.TEMPORAL_ADDRESS || 'localhost:7233'}`);
if (!['localhost', '127.0.0.1'].includes(addr.hostname)) process.exit(0); // remote / Temporal Cloud
const busy = await new Promise((ok) => connect(Number(addr.port || 7233), '127.0.0.1').on('connect', function () { this.end(); ok(true); }).on('error', () => ok(false)));
if (busy) { console.log(`[temporal] already running on :${addr.port || 7233}`); process.exit(0); }
mkdirSync(resolve(root, '.data'), { recursive: true });
spawn(bin, ['server', 'start-dev', '--db-filename', resolve(root, '.data/temporal.db'), '--port', addr.port || '7233', '--ui-port', '8233', '--log-level', 'warn'], { stdio: 'inherit' })
  .on('exit', (code) => process.exit(code ?? 0));
