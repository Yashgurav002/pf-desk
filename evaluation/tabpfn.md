# TabPFN evaluation

Generated 2026-10-14 by `ml/tabpfn/train_eval.py` (seed 0). Model: **tabpfn-v2 (local)**.

## Data
- Source: `ml/tabpfn/history.csv` — **synthetic** history (600 rows), de-identified feature columns only.
- Time-ordered split by `submitted_at`: oldest 70% train (n=420), newest 30% test (n=180).
- Dates: 2025-04-22 → 2026-04-19 (train) / 2026-04-20 → 2026-09-04 (test).
- Rejection rate: train 29.0%, test 37.2%.
- ETA uses settled rows only: train n=298, test n=113.

## Rejection risk (PRD §20 row 1)
| Model | ROC-AUC ↑ | Brier ↓ | Precision @ p≥0.5 ↑ | Flagged |
|---|---|---|---|---|
| Historical rejection rate per form | 0.549 | 0.240 | n/a | 0/180 |
| Logistic regression | 0.817 | 0.166 | 0.78 | 46/180 |
| Gradient boosting (HistGB, default) | 0.751 | 0.202 | 0.72 | 46/180 |
| TabPFN (tabpfn-v2 (local)) | 0.834 | 0.163 | 0.73 | 56/180 |

Best ROC-AUC: **TabPFN (tabpfn-v2 (local))**; best Brier: **TabPFN (tabpfn-v2 (local))**. TabPFN fit+predict: 9.0s on CPU.

## Settlement ETA (PRD §20 row 2)
| Model | MAE days (p50) ↓ | p20–p80 coverage (target ~60%) | Mean interval width (days) |
|---|---|---|---|
| Median per form (p20/p80 per form) | 3.67 | 66% | 8.0 |
| TabPFN regressor (tabpfn-v2 (local)) | 2.92 | 50% | 5.7 |

TabPFN fit+predict: 7.6s on CPU.

## Notes
- **Synthetic data.** These numbers show the pipeline works end to end; they say nothing about real-world accuracy.
  The synthetic generator plants the signal, so every model can find it. Rerun this script on dad's real history
  (T2.9, `pnpm export-history` then this script) before quoting any number.
- Precision @ high-risk = share of test claims with p ≥ 0.5 that were actually rejected; "Flagged" is how many hit that threshold.
- An 80/20 quantile interval should cover about 60% of outcomes; much higher means too wide, much lower means overconfident.
- TabPFN v2 runs locally without a licence login; v2.5+/3.5 weights need a Prior Labs token (`TABPFN_TOKEN`).
  TabPFN weights are under a **non-commercial** licence — a paid PF Desk would need a commercial licence from Prior Labs.
