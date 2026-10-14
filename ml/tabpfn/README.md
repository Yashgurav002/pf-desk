# TabPFN service + evaluation

Rejection risk (classification) and settlement ETA (regression) from **de-identified** claim features only
(`common.FEATURES`; any other key in a row is dropped before the model sees it).

## Setup
```sh
python -m venv ml/tabpfn/.venv
ml/tabpfn/.venv/Scripts/python -m pip install -r ml/tabpfn/requirements.txt
cd apps/api && pnpm export-history   # writes ml/tabpfn/history.csv
```

## Run
```sh
ml/tabpfn/.venv/Scripts/python -I ml/tabpfn/serve.py        # 127.0.0.1:$TABPFN_PORT (8790)
ml/tabpfn/.venv/Scripts/python -I ml/tabpfn/train_eval.py   # -> evaluation/tabpfn.md
ml/tabpfn/.venv/Scripts/python -I ml/tabpfn/common.py       # prep self-check
```

## Model selection (same in both scripts)
| Env | Model | Name reported |
|---|---|---|
| none | TabPFN v2 open weights, CPU, offline | `tabpfn-v2 (local)` |
| `TABPFN_TOKEN` | TabPFN v3.5 local (licence accepted via token) | `tabpfn-v3.5 (local)` |
| `TABPFN_MODE=api` + `TABPFN_API_KEY` | Prior Labs API via `tabpfn-client` (`pip install tabpfn-client`; untested, no key yet) | `tabpfn-3.5 (api)` |

v2.5+ local weights are licence-gated (browser login) and fail headless without `TABPFN_TOKEN`.
TabPFN weights are non-commercial; a paid product needs a commercial licence.

## API
- `GET /health` → `{"ok": true, "model": "..."}`
- `POST /predict` `{"task": "risk"|"eta", "train": [row...], "rows": [row...]}`
  - risk: train rows carry `outcome` (`settled`/`rejected`) → `{"model", "p_reject": [...]}`
  - eta: train rows (settled only) carry `days_to_outcome` → `{"model", "p20", "p50", "p80"}`
  - 400 `{"error"}` on bad input (< 20 train rows, one class, bad task/target); 500 `{"error"}` on failure.

Fitted models are cached by (task, sha256 of `train`), 4 entries. First call with a new train set ≈ 5–6 s on CPU
(~420 rows); repeat calls ≈ 0.25 s. Keep `train` byte-identical (same order) between calls to hit the cache.
