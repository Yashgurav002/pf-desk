// `pnpm dev` hook: serves the fine-tuned decoder (Qwen3-8B Q4 from Ollama + PF Desk LoRA) with llama-server on :8791.
// Ollama 0.17's engine can't load LoRA adapters, so llama-server applies it at runtime instead. Skips quietly if not exported yet.
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const dir = import.meta.dirname;
const bin = `${dir}/out/llama-bin/llama-server${process.platform === 'win32' ? '.exe' : ''}`;
const lora = `${dir}/out/pfdesk-lora.gguf`;
if (!existsSync(bin) || !existsSync(lora)) {
  console.warn('[decoder] not exported yet (see ml/decoder/export.md) — API uses Gemma few-shot meanwhile.');
  process.exit(0);
}
let base;
try {
  base = execSync('ollama show qwen3:8b --modelfile', { encoding: 'utf8' }).match(/^FROM (.+)$/m)[1].trim();
} catch {
  console.warn('[decoder] `ollama pull qwen3:8b` first — API uses Gemma few-shot meanwhile.');
  process.exit(0);
}
const port = new URL(process.env.DECODER_BASE_URL || 'http://127.0.0.1:8791/v1').port || '8791';
spawn(bin, ['-m', base, '--lora', lora, '--host', '127.0.0.1', '--port', port, '-c', '4096', '--jinja',
  '--chat-template-kwargs', '{"enable_thinking":false}', '--temp', '0', '--log-disable'], { stdio: 'inherit' })
  .on('exit', (code) => process.exit(code ?? 0));
