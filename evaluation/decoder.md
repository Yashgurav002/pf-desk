# Rejection Decoder evaluation

Updated 2026-10-14 15:14 · test set: 30 examples from `ml/decoder/data/test.jsonl` (15 categories; clean originals + noisy copies; 25 hard groups). Split is grouped by source remark, so no remark or its augmentations appear in both train and test.

**Data is synthetic** (template grammar + hand-written EPFO-style remarks, see `ml/decoder/data/README.md`). Template phrasing overlaps between groups, so these scores are optimistic for real portal remarks — retrain and re-run on the consultant's labelled remarks (label tool at `/label`).

| System | Macro-F1 | F1 clean | F1 noisy | F1 hard | JSON valid | Fields Jaccard | Fix-step Jaccard | p50 latency | Cost / 1k remarks |
|---|---|---|---|---|---|---|---|---|---|
| gemma3:4b few-shot (Ollama, laptop) | 0.951 | 0.877 | 0.988 | 1.000 | 90% | 0.75 | 0.80 | 4.85s | $0.000 |

Latency: Tinker rows are remote API round-trips (32 concurrent); Ollama rows are on the laptop (CPU, sequential). Cost: Tinker sampling at $0.6/M tokens (prompt + output); local models cost nothing per call.

Training: not run yet
