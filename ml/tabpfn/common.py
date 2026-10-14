"""Shared feature prep + model selection for serve.py and train_eval.py.

Only de-identified columns ever reach a model (FEATURES); everything else in a row is dropped.
"""
import os
import warnings

import numpy as np
import pandas as pd

CATEGORICAL = ["form", "age_band", "employer_size_band", "office_code"]
BOOLEAN = ["dob_match", "bank_verified", "kyc_approved", "aadhaar_linked", "exit_marked"]
NUMERIC = ["service_months", "name_match", "father_match", "months_since_exit", "submit_month"]
FEATURES = ["form", "service_months", "age_band", "employer_size_band", "name_match", "father_match",
            "dob_match", "bank_verified", "kyc_approved", "aadhaar_linked", "exit_marked",
            "months_since_exit", "submit_month", "office_code"]
CAT_IDX = [FEATURES.index(c) for c in CATEGORICAL]
# a few hundred rows on CPU is fine (seconds); silence the "more than 200 samples" nag
warnings.filterwarnings("ignore", message="Running on CPU with more than")


def _bool(v):
    if isinstance(v, str):
        v = v.strip().lower()
        return 1.0 if v in ("true", "1", "yes") else 0.0 if v in ("false", "0", "no") else np.nan
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return np.nan
    return float(bool(v))


def frame(rows) -> pd.DataFrame:
    """rows (list of dicts or DataFrame) -> clean DataFrame of FEATURES. Missing columns become NaN."""
    df = pd.DataFrame(rows).reindex(columns=FEATURES)
    for c in CATEGORICAL:
        df[c] = df[c].map(lambda v: None if v is None or (isinstance(v, float) and np.isnan(v)) else str(v)).astype(object)
    for c in BOOLEAN:
        df[c] = df[c].map(_bool).astype(float)
    for c in NUMERIC:
        df[c] = pd.to_numeric(df[c], errors="coerce").astype(float)
    return df


class Encoder:
    """Ordinal-codes categoricals from the train set; unseen/missing categories -> -1 (never crashes)."""

    def fit(self, df: pd.DataFrame):
        self.vocab = {c: {v: i for i, v in enumerate(sorted(df[c].dropna().unique()))} for c in CATEGORICAL}
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        out = df.copy()
        for c in CATEGORICAL:
            out[c] = df[c].map(lambda v, m=self.vocab[c]: m.get(v, -1)).astype(float)
        return out.to_numpy(dtype=float)


def model_choice():
    """(model name, ModelVersion or None for api mode). Same rule in serve and eval."""
    if os.environ.get("TABPFN_MODE") == "api" and os.environ.get("TABPFN_API_KEY"):
        return "tabpfn-3.5 (api)", None
    from tabpfn.constants import ModelVersion
    if os.environ.get("TABPFN_TOKEN"):
        return "tabpfn-v3.5 (local)", ModelVersion.V3_5
    return "tabpfn-v2 (local)", ModelVersion.V2


def make_estimator(task: str, **local_kw):
    """task 'risk' -> classifier, 'eta' -> regressor. Seeded for determinism. local_kw go to local TabPFN only."""
    name, version = model_choice()
    if version is None:
        import tabpfn_client
        tabpfn_client.set_access_token(os.environ["TABPFN_API_KEY"])
        return tabpfn_client.TabPFNClassifier() if task == "risk" else tabpfn_client.TabPFNRegressor()
    from tabpfn import TabPFNClassifier, TabPFNRegressor
    cls = TabPFNClassifier if task == "risk" else TabPFNRegressor
    return cls.create_default_for_version(version, device="cpu", random_state=0,
                                          categorical_features_indices=CAT_IDX, **local_kw)


if __name__ == "__main__":  # self-check of the prep
    d = frame([{"form": 19, "dob_match": "true", "bank_verified": False, "service_months": -1, "name_match": "0.9"},
               {"form": "31", "dob_match": True, "office_code": "MHX", "extra_pii": "drop me"}])
    assert list(d.columns) == FEATURES and d.loc[0, "form"] == "19" and d.loc[0, "dob_match"] == 1.0
    assert d.loc[0, "bank_verified"] == 0.0 and d.loc[0, "service_months"] == -1 and d.loc[0, "name_match"] == 0.9
    enc = Encoder().fit(d.iloc[:1])
    x = enc.transform(frame([{"form": "99", "office_code": "NEW"}]))
    assert x[0, FEATURES.index("form")] == -1 and x[0, FEATURES.index("office_code")] == -1
    print("common ok")
