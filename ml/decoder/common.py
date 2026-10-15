"""Shared bits for the Rejection Decoder: data loading, output parsing, metrics."""
import json
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "data"
BASE_MODEL = "Qwen/Qwen3-8B"
RENDERER = "qwen3_disable_thinking"
SYSTEM_PROMPT = (HERE / "system_prompt.txt").read_text(encoding="utf-8").strip()
VOCAB = json.loads((HERE / "labels.json").read_text(encoding="utf-8"))
CATEGORIES = list(VOCAB["categories"])
FIX_IDS = sorted({f for c in VOCAB["categories"].values() for f in c["fix"]})


def load(name: str) -> list[dict]:
    return [json.loads(line) for line in (DATA / name).read_text(encoding="utf-8").splitlines() if line.strip()]


def target(ex: dict) -> dict:
    return json.loads(ex["messages"][-1]["content"])


def parse(text: str, strict: bool = False) -> dict | None:
    """Model output -> {category, fields_involved, fix_step_ids} or None if not JSON with a known category.
    Unknown field / fix-step names are dropped (the app does the same); strict=True rejects them instead."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    start, end = text.find("{"), text.rfind("}")
    try:
        d = json.loads(text[start : end + 1])
    except (ValueError, TypeError):
        return None
    if not isinstance(d, dict) or d.get("category") not in CATEGORIES:
        return None
    fields = d.get("fields_involved") or []
    fixes = d.get("fix_step_ids") or []
    if not (isinstance(fields, list) and isinstance(fixes, list)):
        return None
    if strict and (any(f not in VOCAB["fields"] for f in fields) or any(f not in FIX_IDS for f in fixes)):
        return None
    return {"category": d["category"], "fields_involved": sorted(f for f in fields if f in VOCAB["fields"]),
            "fix_step_ids": sorted(f for f in fixes if f in FIX_IDS)}


def macro_f1(gold: list[str], pred: list[str | None]) -> float:
    f1s = []
    for c in CATEGORIES:
        tp = sum(g == c and p == c for g, p in zip(gold, pred))
        fp = sum(g != c and p == c for g, p in zip(gold, pred))
        fn = sum(g == c and p != c for g, p in zip(gold, pred))
        if tp + fp + fn:
            f1s.append(2 * tp / (2 * tp + fp + fn))
    return sum(f1s) / len(f1s)


def jaccard(a: list[str], b: list[str]) -> float:
    a, b = set(a), set(b)
    return 1.0 if not a and not b else len(a & b) / len(a | b)


if __name__ == "__main__":
    assert parse('```json\n{"category":"dob_mismatch","fields_involved":["dob"],"fix_step_ids":["R-DOB"]}\n```')["category"] == "dob_mismatch"
    assert parse('{"category":"nope"}') is None and parse("not json") is None
    assert parse('{"category":"other","fields_involved":["made_up"]}', strict=True) is None
    assert parse('{"category":"other","fields_involved":["made_up","name"]}')["fields_involved"] == ["name"]
    assert macro_f1(["other", "dob_mismatch"], ["other", "dob_mismatch"]) == 1.0
    assert macro_f1(["other", "dob_mismatch"], ["other", None]) < 1.0
    assert jaccard([], []) == 1.0 and jaccard(["a"], ["a", "b"]) == 0.5
    print("common ok")
