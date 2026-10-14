"""PF Desk TabPFN service. Stdlib HTTP, 127.0.0.1:$TABPFN_PORT (default 8790).

GET  /health  -> {"ok": true, "model": name}
POST /predict {"task": "risk"|"eta", "train": [row...], "rows": [row...]}
     risk -> {"model", "p_reject": [...]}; eta -> {"model", "p20", "p50", "p80"}
Never logs row contents.
"""
import hashlib
import json
import os
import sys
import threading
import time
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # -I drops the script dir
from common import Encoder, frame, make_estimator, model_choice  # noqa: E402

MODEL, _ = model_choice()
MIN_TRAIN = 20
MAX_BODY = 10 * 1024 * 1024
CACHE_SIZE = 4
_cache: OrderedDict = OrderedDict()  # (task, sha256(train)) -> (encoder, fitted estimator)
# ponytail: one global lock, so fits/predicts run one at a time; fine for one consultant's desk,
# use a worker pool / per-key locks if several users hit it at once.
_lock = threading.Lock()


class BadInput(ValueError):
    pass


def _targets(task, train):
    try:
        if task == "risk":
            y = np.array([1 if r["outcome"] == "rejected" else 0 if r["outcome"] == "settled" else None for r in train])
            if None in y:
                raise BadInput("outcome must be 'settled' or 'rejected'")
            if len(set(y)) < 2:
                raise BadInput("train needs both settled and rejected rows")
            return y.astype(int)
        return np.array([float(r["days_to_outcome"]) for r in train])
    except (KeyError, TypeError, ValueError) as e:
        if isinstance(e, BadInput):
            raise
        raise BadInput(f"bad target in train rows ({type(e).__name__})")


def _fitted(task, train):
    key = (task, hashlib.sha256(json.dumps(train, sort_keys=True).encode()).hexdigest())
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]
    y = _targets(task, train)
    df = frame(train)
    enc = Encoder().fit(df)
    # fit_with_cache: pay the train-set forward pass once at fit, so cached calls only predict (~6s -> <1s)
    est = make_estimator(task, fit_mode="fit_with_cache")
    est.fit(enc.transform(df), y)
    _cache[key] = (enc, est)
    if len(_cache) > CACHE_SIZE:
        _cache.popitem(last=False)
    return enc, est


def predict(body):
    task, train, rows = body.get("task"), body.get("train"), body.get("rows")
    if task not in ("risk", "eta"):
        raise BadInput("task must be 'risk' or 'eta'")
    if not isinstance(train, list) or len(train) < MIN_TRAIN or not all(isinstance(r, dict) for r in train):
        raise BadInput(f"train must be a list of at least {MIN_TRAIN} row objects")
    if not isinstance(rows, list) or not rows or not all(isinstance(r, dict) for r in rows):
        raise BadInput("rows must be a non-empty list of row objects")
    with _lock:
        enc, est = _fitted(task, train)
        X = enc.transform(frame(rows))
        if task == "risk":
            classes = list(est.classes_)
            p = est.predict_proba(X)[:, classes.index(1)]
            return {"model": MODEL, "p_reject": [round(float(v), 4) for v in p]}
        q = np.sort(np.clip(np.vstack(est.predict(X, output_type="quantiles", quantiles=[0.2, 0.5, 0.8])), 0, None), axis=0)
        return {"model": MODEL, **{k: [round(float(v), 1) for v in q[i]] for i, k in enumerate(("p20", "p50", "p80"))}}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "model": MODEL})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/predict":
            return self._send(404, {"error": "not found"})
        t0 = time.perf_counter()
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > MAX_BODY:
                raise BadInput("missing or oversized body")
            body = json.loads(self.rfile.read(n))
            if not isinstance(body, dict):
                raise BadInput("body must be a JSON object")
            out = predict(body)
        except (BadInput, json.JSONDecodeError, UnicodeDecodeError) as e:
            return self._send(400, {"error": str(e)})
        except Exception as e:  # never echo row data, only the error type
            sys.stderr.write(f"predict failed: {type(e).__name__}\n")
            return self._send(500, {"error": f"prediction failed ({type(e).__name__})"})
        sys.stderr.write(f"predict task={body['task']} train={len(body['train'])} rows={len(body['rows'])} "
                         f"{(time.perf_counter() - t0) * 1000:.0f}ms\n")
        self._send(200, out)

    def log_message(self, fmt, *args):  # default access log is fine (path + status only), keep it quiet
        pass


def warm():
    """Load weights once so the first real call doesn't pay for it."""
    rng = np.random.default_rng(0)
    rows = [{"form": "19", "service_months": int(rng.integers(1, 200)), "outcome": ("settled", "rejected")[i % 2],
             "days_to_outcome": int(rng.integers(5, 40))} for i in range(MIN_TRAIN)]
    for task in ("risk", "eta"):
        predict({"task": task, "train": rows, "rows": rows[:1]})
    _cache.clear()


if __name__ == "__main__":
    port = int(os.environ.get("TABPFN_PORT", "8790"))
    t0 = time.perf_counter()
    warm()
    sys.stderr.write(f"{MODEL} warm in {time.perf_counter() - t0:.1f}s; listening on 127.0.0.1:{port}\n")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
