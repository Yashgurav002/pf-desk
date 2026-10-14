"""PRD §14 / §20 rows 1-2: time-ordered eval of TabPFN vs baselines -> evaluation/tabpfn.md.

Run: ml/tabpfn/.venv/Scripts/python -I ml/tabpfn/train_eval.py [path/to/history.csv]
"""
import datetime
import os
import random
import sys
import time

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, mean_absolute_error, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # -I drops the script dir
from common import BOOLEAN, CAT_IDX, CATEGORICAL, NUMERIC, Encoder, frame, make_estimator, model_choice  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SEED = 0
random.seed(SEED)
np.random.seed(SEED)


def risk_metrics(y, p):
    flagged = p >= 0.5
    prec = float(y[flagged].mean()) if flagged.any() else float("nan")
    return roc_auc_score(y, p), brier_score_loss(y, p), prec, int(flagged.sum())


def table(header, rows):
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def main(path):
    df = pd.read_csv(path, dtype={"form": str, "office_code": str})
    df = df.sort_values("submitted_at", kind="stable").reset_index(drop=True)
    cut = int(len(df) * 0.7)
    tr, te = df.iloc[:cut], df.iloc[cut:]
    model_name, _ = model_choice()

    # ---- risk ----
    ytr, yte = (tr.outcome == "rejected").to_numpy(int), (te.outcome == "rejected").to_numpy(int)
    Ftr, Fte = frame(tr), frame(te)
    enc = Encoder().fit(Ftr)
    Xtr, Xte = enc.transform(Ftr), enc.transform(Fte)

    rate = tr.groupby("form").outcome.apply(lambda s: (s == "rejected").mean())
    p_form = te.form.map(rate).fillna(ytr.mean()).to_numpy(float)

    lr = make_pipeline(
        ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
                           ("num", make_pipeline(SimpleImputer(), StandardScaler()), NUMERIC + BOOLEAN)]),
        LogisticRegression(max_iter=2000, random_state=SEED))
    p_lr = lr.fit(Ftr, ytr).predict_proba(Fte)[:, 1]

    gb = HistGradientBoostingClassifier(random_state=SEED, categorical_features=CAT_IDX)
    nan_unseen = lambda X: np.where(X < 0, np.nan, X)  # HistGB wants unseen categories as missing, not -1
    p_gb = gb.fit(nan_unseen(Xtr), ytr).predict_proba(nan_unseen(Xte))[:, 1]

    t0 = time.perf_counter()
    clf = make_estimator("risk").fit(Xtr, ytr)
    p_tp = clf.predict_proba(Xte)[:, list(clf.classes_).index(1)]
    t_risk = time.perf_counter() - t0

    risk_rows = []
    for name, p in [("Historical rejection rate per form", p_form), ("Logistic regression", p_lr),
                    ("Gradient boosting (HistGB, default)", p_gb), (f"TabPFN ({model_name})", p_tp)]:
        auc, brier, prec, n = risk_metrics(yte, p)
        risk_rows.append([name, f"{auc:.3f}", f"{brier:.3f}", "n/a" if np.isnan(prec) else f"{prec:.2f}", f"{n}/{len(yte)}"])
    best = lambda i, f: min(risk_rows, key=lambda r: f(float(r[i])))[0]
    risk_best = f"Best ROC-AUC: **{best(1, lambda v: -v)}**; best Brier: **{best(2, lambda v: v)}**."
    risk_tbl = table(["Model", "ROC-AUC ↑", "Brier ↓", "Precision @ p≥0.5 ↑", "Flagged"], risk_rows)

    # ---- eta (settled only) ----
    str_, ste = tr[tr.outcome == "settled"], te[te.outcome == "settled"]
    dtr, dte = str_.days_to_outcome.to_numpy(float), ste.days_to_outcome.to_numpy(float)
    g = str_.groupby("form").days_to_outcome
    q = {k: g.quantile(v) for k, v in (("p20", 0.2), ("p50", 0.5), ("p80", 0.8))}
    base = {k: ste.form.map(s).fillna(np.quantile(dtr, float(k[1:]) / 100)).to_numpy(float) for k, s in q.items()}

    Fs, Fst = frame(str_), frame(ste)
    enc_s = Encoder().fit(Fs)
    t0 = time.perf_counter()
    reg = make_estimator("eta").fit(enc_s.transform(Fs), dtr)
    tp = dict(zip(("p20", "p50", "p80"), reg.predict(enc_s.transform(Fst), output_type="quantiles", quantiles=[0.2, 0.5, 0.8])))
    t_eta = time.perf_counter() - t0

    def eta_row(name, d):
        cov = np.mean((dte >= d["p20"]) & (dte <= d["p80"]))
        return [name, f"{mean_absolute_error(dte, d['p50']):.2f}", f"{cov:.0%}", f"{np.mean(d['p80'] - d['p20']):.1f}"]
    eta_tbl = table(["Model", "MAE days (p50) ↓", "p20–p80 coverage (target ~60%)", "Mean interval width (days)"],
                    [eta_row("Median per form (p20/p80 per form)", base), eta_row(f"TabPFN regressor ({model_name})", tp)])

    # ---- report ----
    split = f"{tr.submitted_at.min()} → {tr.submitted_at.max()} (train) / {te.submitted_at.min()} → {te.submitted_at.max()} (test)"
    md = f"""# TabPFN evaluation

Generated {datetime.date.today().isoformat()} by `ml/tabpfn/train_eval.py` (seed {SEED}). Model: **{model_name}**.

## Data
- Source: `{os.path.relpath(path, ROOT).replace(os.sep, '/')}` — **synthetic** history ({len(df)} rows), de-identified feature columns only.
- Time-ordered split by `submitted_at`: oldest 70% train (n={len(tr)}), newest 30% test (n={len(te)}).
- Dates: {split}.
- Rejection rate: train {ytr.mean():.1%}, test {yte.mean():.1%}.
- ETA uses settled rows only: train n={len(str_)}, test n={len(ste)}.

## Rejection risk (PRD §20 row 1)
{risk_tbl}

{risk_best} TabPFN fit+predict: {t_risk:.1f}s on CPU.

## Settlement ETA (PRD §20 row 2)
{eta_tbl}

TabPFN fit+predict: {t_eta:.1f}s on CPU.

## Notes
- **Synthetic data.** These numbers show the pipeline works end to end; they say nothing about real-world accuracy.
  The synthetic generator plants the signal, so every model can find it. Rerun this script on dad's real history
  (T2.9, `pnpm export-history` then this script) before quoting any number.
- Precision @ high-risk = share of test claims with p ≥ 0.5 that were actually rejected; "Flagged" is how many hit that threshold.
- An 80/20 quantile interval should cover about 60% of outcomes; much higher means too wide, much lower means overconfident.
- TabPFN v2 runs locally without a licence login; v2.5+/3.5 weights need a Prior Labs token (`TABPFN_TOKEN`).
  TabPFN weights are under a **non-commercial** licence — a paid PF Desk would need a commercial licence from Prior Labs.
"""
    out = os.path.join(ROOT, "evaluation", "tabpfn.md")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(md)
    sys.stdout.reconfigure(encoding="utf-8")
    print("Rejection risk\n" + risk_tbl + "\n\nSettlement ETA\n" + eta_tbl + f"\n\nwrote {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "history.csv"))
