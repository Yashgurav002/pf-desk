# Running the fine-tuned decoder on the laptop

```sh
cd ml/decoder
python -m venv .venv && .venv/Scripts/python -m pip install tinker tinker-cookbook
ollama pull qwen3:8b                       # base model file (~5 GB), reused as-is
.venv/Scripts/python export.py             # needs TINKER_API_KEY + run.json from tinker_train.py
```

`pnpm dev` then starts `llama-server` on :8791 (via `run.mjs`) and the API's decode endpoint uses it
(`DECODER_MODEL=pfdesk-decoder`, `DECODER_BASE_URL=http://127.0.0.1:8791/v1`). If it's not running, the API falls back to Gemma few-shot.

What `export.py` does:
1. Downloads the Tinker sampler checkpoint (LoRA, rank 32, ~350 MB).
2. Converts it to a PEFT adapter. Only the base model's config/tokenizer and safetensors *headers* are fetched — not the 16 GB weights.
3. Converts the PEFT adapter to a GGUF LoRA (185 MB) with llama.cpp `b11200`'s `convert_lora_to_gguf.py`.
4. Downloads llama.cpp `b11200` Windows binaries for `llama-server`.

Why not `ollama create` with `ADAPTER`: Ollama 0.17's engine returns "loras are not yet implemented" for this model,
so `llama-server` applies the LoRA at runtime on top of Ollama's own `qwen3:8b` Q4 file instead.
The prompt format matches training (`qwen3_disable_thinking`: empty `<think>` block) via `--chat-template-kwargs '{"enable_thinking":false}'`.

Note: the LoRA was trained on bf16 weights and runs on a Q4_K_M base here; compare the "laptop" row with the Tinker row in `evaluation/decoder.md` to see what quantisation costs.
