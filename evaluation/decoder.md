# Rejection Decoder evaluation

Updated 2026-10-14 15:53 · test set: 290 examples from `ml/decoder/data/test.jsonl` (15 categories; clean originals + noisy copies; 25 hard groups). Split is grouped by source remark, so no remark or its augmentations appear in both train and test.

**Data is synthetic** (template grammar + hand-written EPFO-style remarks, see `ml/decoder/data/README.md`). Template phrasing overlaps between groups, so these scores are optimistic for real portal remarks — retrain and re-run on the consultant's labelled remarks (label tool at `/label`).

| System | Macro-F1 | F1 clean | F1 noisy | F1 hard | JSON valid | Fields Jaccard | Fix-step Jaccard | p50 latency | Cost / 1k remarks |
|---|---|---|---|---|---|---|---|---|---|
| Qwen3-8B zero-shot (Tinker) | 0.848 | 0.871 | 0.825 | 0.562 | 99% | 0.74 | 0.74 | 2.36s | $0.204 |
| Qwen3-8B + PF Desk LoRA (Tinker) | 0.939 | 0.936 | 0.942 | 0.694 | 100% | 0.93 | 0.93 | 2.38s | $0.199 |
| gemma3:4b few-shot (Ollama, laptop) | 0.861 | 0.865 | 0.857 | 0.513 | 97% | 0.81 | 0.81 | 4.90s | $0.000 |

Latency: Tinker rows are remote API round-trips (32 concurrent); Ollama rows are on the laptop (CPU, sequential). Cost: Tinker sampling at $0.6/M tokens (prompt + output); local models cost nothing per call.

Training: {"model_path": "tinker://4f830dbf-312a-5ee1-a853-70933a67d0ad:train:0/sampler_weights/final", "base_model": "Qwen/Qwen3-8B", "renderer": "qwen3_disable_thinking", "rank": 32, "lr": 0.00047297908091376354, "epochs": 2, "batch": 32, "train_examples": 1356, "train_tokens": 896008, "est_cost_usd": 0.39, "finished": "2026-10-14 15:28"}
