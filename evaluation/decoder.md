# Rejection Decoder evaluation

Updated 2026-10-15 20:32 · test set: 388 examples from `ml/decoder/data/test.jsonl` (20 categories; clean originals + noisy copies; 25 hard groups). Split is grouped by source remark, so no remark or its augmentations appear in both train and test.

**Data is synthetic** (template grammar + hand-written EPFO-style remarks, see `ml/decoder/data/README.md`). Template phrasing overlaps between groups, so these scores are optimistic for real portal remarks — retrain and re-run on the consultant's labelled remarks (label tool at `/label`).

| System | Macro-F1 | F1 clean | F1 noisy | F1 hard | JSON valid | Fields Jaccard | Fix-step Jaccard | p50 latency | Cost / 1k remarks |
|---|---|---|---|---|---|---|---|---|---|
| gemma3:4b few-shot (Ollama, laptop) | 0.808 | 0.821 | 0.795 | 0.622 | 100% | 0.75 | 0.76 | 4.94s | $0.000 |
| Qwen3-8B zero-shot (Tinker) | 0.823 | 0.819 | 0.825 | 0.723 | 100% | 0.78 | 0.77 | 2.45s | $0.243 |
| Qwen3-8B + PF Desk LoRA (Tinker) | 0.961 | 0.968 | 0.955 | 0.961 | 100% | 0.96 | 0.94 | 2.59s | $0.238 |

Latency: Tinker rows are remote API round-trips (32 concurrent); laptop rows are local CPU inference, one at a time. Cost: Tinker sampling at $0.6/M tokens (prompt + output); local models cost nothing per call.

Training: {"model_path": "tinker://deb6174b-5c3d-53c2-922d-d3e6257ad060:train:0/sampler_weights/final", "base_model": "Qwen/Qwen3-8B", "renderer": "qwen3_disable_thinking", "rank": 32, "lr": 0.00047297908091376354, "epochs": 2, "batch": 32, "train_examples": 1864, "train_tokens": 1470356, "est_cost_usd": 0.65, "finished": "2026-10-15 19:42"}
