# Rejection Decoder on real public EPFO remarks

Updated 2026-10-15 20:48 · 148 remark texts that members and articles posted publicly (`ml/decoder/data/public_remarks.jsonl`, sources per row, labelled by us from the source's own explanation; see `public_remarks.md`). **Never used for training.** This is the honest out-of-distribution check: the decoder was trained only on synthetic remarks.

| System | Macro-F1 | Accuracy | Accuracy (2nd label ok) | Usable JSON | Strict schema | p50 latency |
|---|---|---|---|---|---|---|
| Qwen3-8B Q4 + PF Desk LoRA (llama-server, laptop) | 0.737 | 72% | 79% | 100% | 100% | 6.00s |
| gemma3:4b few-shot (Ollama, laptop) | 0.503 | 53% | 64% | 99% | 95% | 4.88s |
| Qwen3-8B zero-shot (Tinker) | 0.627 | 58% | 63% | 99% | 96% | 2.33s |
| Qwen3-8B + PF Desk LoRA (Tinker) | 0.725 | 72% | 78% | 100% | 100% | 2.44s |

"Usable JSON": known category (invented field / fix-step names are dropped, as the app does). "Strict schema": no invented names at all. "2nd label ok": for remarks marked ambiguous, the labeller's alternative category also counts as correct.

## Version history (same 148 remarks)

| Decoder | Categories | Accuracy | Notes |
|---|---|---|---|
| v1 (Tinker LoRA, 1,356 synthetic examples) | 15 | 68% (base model 53%) | 43% of real remarks fit none of the 15 categories |
| v2 (+5 categories from this study, own templates) | 20 | 66% (base 58%) | invented field names made 9 answers unusable under strict parsing |
| v3 (+templates for reconciliation / wrong-para / bank-proof wording) | 20 | **72%** (base 58%, Gemma 53%) | 100% strict schema; laptop Q4 export matches the cloud model |

v2/v3 were shaped by looking at this set's error categories (never its text), so treat v3's number as optimistic; the clean check is the consultant's own remarks (label tool at `/label`).
