# Rejection Decoder on real public EPFO remarks

Updated 2026-10-15 20:00 · 148 remark texts that members and articles posted publicly (`ml/decoder/data/public_remarks.jsonl`, sources per row, labelled by us from the source's own explanation; see `public_remarks.md`). **Never used for training.** This is the honest out-of-distribution check: the decoder was trained only on synthetic remarks.

| System | Macro-F1 | Accuracy | Accuracy (2nd label ok) | Usable JSON | Strict schema | p50 latency |
|---|---|---|---|---|---|---|
| gemma3:4b few-shot (Ollama, laptop) | 0.503 | 53% | 64% | 99% | 95% | 4.88s |
| Qwen3-8B zero-shot (Tinker) | 0.627 | 58% | 63% | 99% | 96% | 2.33s |
| Qwen3-8B + PF Desk LoRA (Tinker) | 0.725 | 72% | 78% | 100% | 100% | 2.44s |

"Usable JSON": known category (invented field / fix-step names are dropped, as the app does). "Strict schema": no invented names at all. "2nd label ok": for remarks marked ambiguous, the labeller's alternative category also counts as correct.
