// Cross-platform launcher for the TabPFN venv: `setup` creates it, otherwise runs <name>.py with the venv python.
import { spawnSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const dir = import.meta.dirname;
const py = `${dir}/.venv/${process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'}`;
const task = process.argv[2];

if (task === 'setup') {
  const sys = process.platform === 'win32' ? 'python' : 'python3';
  for (const args of [[sys, '-m', 'venv', '.venv'], [py, '-m', 'pip', 'install', '-r', 'requirements.txt']]) {
    const r = spawnSync(args[0], args.slice(1), { cwd: dir, stdio: 'inherit' });
    if (r.status) process.exit(r.status);
  }
} else if (!existsSync(py)) {
  console.warn('[tabpfn] venv missing — run `pnpm --filter tabpfn setup`. API will use baselines meanwhile.');
} else {
  spawn(py, ['-I', `${dir}/${task}.py`], { stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 0));
}
