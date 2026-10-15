// OpenAI-compatible chat + embeddings (Ollama locally). Every chat goes through the PII tokenizer.
import type { Pii } from './pii.ts';
import { query } from './db.ts';
import { span } from './sentry.ts';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const base = () => (process.env.LLM_BASE_URL || 'http://localhost:11434/v1').replace(/\/$/, '');

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.LLM_API_KEY) h.authorization = `Bearer ${process.env.LLM_API_KEY}`;
  return h;
}

export async function chat(
  messages: ChatMessage[],
  pii: Pii,
  opts: { json?: boolean; model?: string; baseUrl?: string; kind?: string } = {},
): Promise<string> {
  const model = opts.model || process.env.LLM_MODEL || 'gemma3:4b';
  const url = `${(opts.baseUrl || base()).replace(/\/$/, '')}/chat/completions`;
  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    messages: messages.map((m) => ({ role: m.role, content: pii.tokenize(m.content) })),
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const t0 = Date.now();
  const data: any = await span(`llm.${opts.kind ?? 'chat'}`, 'gen_ai.chat', { model }, async () => {
    const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  });
  const reply: string = data.choices?.[0]?.message?.content ?? '';

  await query('insert into agent_runs (kind, model, tokens_in, tokens_out, latency_ms) values ($1,$2,$3,$4,$5)', [
    opts.kind ?? 'chat', model, data.usage?.prompt_tokens ?? null, data.usage?.completion_tokens ?? null, Date.now() - t0,
  ]).catch((e) => console.warn('[llm] agent_runs log failed:', e.message));

  return pii.detokenize(reply);
}

let embedWarned = false;

/** 768-dim embedding (nomic prefixes), or null if the model is unavailable. */
export async function embed(text: string, kind: 'query' | 'document'): Promise<number[] | null> {
  try {
    const prefix = kind === 'query' ? 'search_query: ' : 'search_document: ';
    const res = await fetch(`${base()}/embeddings`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ model: process.env.EMBED_MODEL || 'nomic-embed-text', input: prefix + text }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const v = ((await res.json()) as any).data?.[0]?.embedding;
    if (!Array.isArray(v) || v.length !== 768) throw new Error(`bad embedding length ${v?.length}`);
    return v;
  } catch (e: any) {
    if (!embedWarned) console.warn('[llm] embeddings unavailable, keyword-only search:', e.message);
    embedWarned = true;
    return null;
  }
}
