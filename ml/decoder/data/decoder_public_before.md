# Rejection Decoder on real public EPFO remarks

Updated 2026-10-15 19:23 · 148 remark texts that members and articles posted publicly (`ml/decoder/data/public_remarks.jsonl`, sources per row, labelled by us from the source's own explanation; see `public_remarks.md`). **Never used for training.** This is the honest out-of-distribution check: the decoder was trained only on synthetic remarks.

| System | Macro-F1 | Accuracy | Accuracy (2nd label ok) | JSON valid | p50 latency |
|---|---|---|---|---|---|
| Qwen3-8B zero-shot (Tinker) | 0.572 | 53% | 59% | 99% | 2.99s |
| Qwen3-8B + PF Desk LoRA (Tinker) | 0.689 | 68% | 76% | 100% | 2.44s |

"2nd label ok": for remarks marked ambiguous, the labeller's alternative category also counts as correct.
