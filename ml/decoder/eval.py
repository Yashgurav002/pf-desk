"""Rejection Decoder evaluation (PRD §15, §20 row 3) on data/test.jsonl -> evaluation/decoder.md

    python eval.py                                   # all systems
    python eval.py --systems gemma,local --limit 40  # subset
    python eval.py --systems base,tuned --test-file public_remarks.jsonl   # real public remarks -> evaluation/decoder_public.md

Systems:
  base      Qwen3-8B zero-shot on Tinker (same prompt, no fine-tune)          needs TINKER_API_KEY
  tuned     fine-tuned Qwen3-8B on Tinker (model_path from run.json)          needs TINKER_API_KEY + run.json
  gemma     Gemma 3 4B few-shot via Ollama on this laptop (current fallback)
  local     fine-tuned decoder: Ollama's qwen3:8b Q4 file + LoRA via llama-server, on this laptop
"""
import argparse
import asyncio
import json
import os
import statistics
import time
import urllib.request

from common import BASE_MODEL, CATEGORIES, DATA, HERE, RENDERER, SYSTEM_PROMPT, VOCAB, jaccard, load, macro_f1, parse, target


def as_example(r: dict) -> dict:
    """public_remarks.jsonl row ({text, category, alt?}) -> same shape as test.jsonl examples."""
    if "messages" in r:
        return r
    c = VOCAB["categories"][r["category"]]
    gold = {"category": r["category"], "fields_involved": sorted(c["fields"]), "fix_step_ids": sorted(c["fix"])}
    return {"messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": r["text"]},
                         {"role": "assistant", "content": json.dumps(gold)}], "alt": r.get("alt"), "kind": r.get("kind")}

LABELS = {"base": "Qwen3-8B zero-shot (Tinker)", "tuned": "Qwen3-8B + PF Desk LoRA (Tinker)", "gemma": "gemma3:4b few-shot (Ollama, laptop)",
          "local": "Qwen3-8B Q4 + PF Desk LoRA (llama-server, laptop)"}
SAMPLE_PRICE_PER_M = 0.60  # USD, Qwen3-8B sampling, tinker models & pricing page, Oct 2026
OLLAMA = os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1")
LOCAL = os.environ.get("DECODER_BASE_URL", "http://127.0.0.1:8791/v1")  # llama-server started by `pnpm dev` (run.mjs)


def fewshot() -> list[dict]:
    """One training example per category, as chat turns (Gemma baseline)."""
    seen, shots = set(), []
    for ex in load("train.jsonl"):
        if ex["category"] not in seen and not ex.get("aug"):
            seen.add(ex["category"])
            shots += ex["messages"][1:]
    return shots


def ollama(model: str, messages: list[dict], base: str = OLLAMA) -> tuple[str, int]:
    body = json.dumps({"model": model, "messages": messages, "temperature": 0, "response_format": {"type": "json_object"}}).encode()
    req = urllib.request.Request(f"{base}/chat/completions", body, {"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.load(r)
    return d["choices"][0]["message"]["content"], d.get("usage", {}).get("total_tokens", 0)


async def run_tinker(model_path: str | None, examples: list[dict]) -> list[tuple[str, float, int]]:
    import tinker
    from tinker_cookbook import renderers
    from tinker_cookbook.tokenizer_utils import get_tokenizer

    service = tinker.ServiceClient()
    client = await (service.create_sampling_client_async(model_path=model_path) if model_path
                    else service.create_sampling_client_async(base_model=BASE_MODEL))
    renderer = renderers.get_renderer(RENDERER, get_tokenizer(BASE_MODEL))
    params = tinker.SamplingParams(max_tokens=160, temperature=0.0, stop=renderer.get_stop_sequences())
    sem = asyncio.Semaphore(32)

    async def one(ex: dict) -> tuple[str, float, int]:
        prompt = renderer.build_generation_prompt(ex["messages"][:-1])
        async with sem:
            t = time.time()
            res = await client.sample_async(prompt=prompt, num_samples=1, sampling_params=params)
            dt = time.time() - t
        toks = res.sequences[0].tokens
        msg, _ = renderer.parse_response(toks)
        return renderers.get_text_content(msg), dt, len(prompt.to_ints()) + len(toks)

    return await asyncio.gather(*(one(ex) for ex in examples))


def run_ollama(model: str, examples: list[dict], shots: list[dict], base: str = OLLAMA) -> list[tuple[str, float, int]]:
    out = []
    for i, ex in enumerate(examples):
        msgs = [ex["messages"][0], *shots, ex["messages"][1]]
        t = time.time()
        try:
            text, toks = ollama(model, msgs, base)
        except Exception as e:  # noqa: BLE001 - a failed call is an invalid answer, not a crash
            text, toks = f"ERROR {e}", 0
        out.append((text, time.time() - t, toks))
        if i % 25 == 0:
            print(f"  {model}: {i}/{len(examples)}")
    return out


def score(examples: list[dict], outs: list[tuple[str, float, int]]) -> dict:
    preds = [parse(o[0]) for o in outs]
    gold = [target(ex) for ex in examples]

    def f1(mask) -> float:
        idx = [i for i, ex in enumerate(examples) if mask(ex)]
        return macro_f1([gold[i]["category"] for i in idx], [preds[i]["category"] if preds[i] else None for i in idx]) if idx else float("nan")

    ok = [p for p in preds if p]
    return {
        "macro_f1": f1(lambda ex: True),
        "f1_clean": f1(lambda ex: not ex.get("aug")),
        "f1_noisy": f1(lambda ex: ex.get("aug")),
        "f1_hard": f1(lambda ex: ex.get("hard")),
        "accuracy": sum(bool(p) and p["category"] == g["category"] for p, g in zip(preds, gold)) / len(gold),
        # ambiguous real remarks: the labeller's second choice also counts
        "accuracy_alt_ok": sum(bool(p) and p["category"] in (g["category"], ex.get("alt")) for p, g, ex in zip(preds, gold, examples)) / len(gold),
        "json_valid": len(ok) / len(preds),
        "schema_strict": sum(parse(o[0], strict=True) is not None for o in outs) / len(outs),
        "fields_jaccard": statistics.mean(jaccard(p["fields_involved"], g["fields_involved"]) if p else 0 for p, g in zip(preds, gold)),
        "fix_jaccard": statistics.mean(jaccard(p["fix_step_ids"], g["fix_step_ids"]) if p else 0 for p, g in zip(preds, gold)),
        "p50_latency_s": statistics.median(o[1] for o in outs),
        "tokens_per_remark": statistics.mean(o[2] for o in outs),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--systems", default="base,tuned,gemma,local")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--gemma-model", default=os.environ.get("LLM_MODEL", "gemma3:4b"))
    ap.add_argument("--local-model", default="pfdesk-decoder")
    ap.add_argument("--test-file", default="test.jsonl")
    ap.add_argument("--rescore", action="store_true", help="re-score saved pred_*.jsonl raw outputs, no model calls")
    a = ap.parse_args()
    public = a.test_file != "test.jsonl"
    examples = [as_example(r) for r in load(a.test_file)][: a.limit or None]
    run = json.loads((HERE / "run.json").read_text()) if (HERE / "run.json").exists() else None
    results: dict[str, dict] = {}
    for name in a.systems.split(","):
        print(f"== {name}")
        if a.rescore:
            saved = [json.loads(l) for l in (DATA / f"pred_{name}{'_public' if public else ''}.jsonl").read_text(encoding="utf-8").splitlines()]
            outs, label = [(s["raw"], s.get("latency", 0.0), s.get("tokens", 0)) for s in saved][: len(examples)], LABELS[name]
        elif name == "base":
            outs, label = asyncio.run(run_tinker(None, examples)), "Qwen3-8B zero-shot (Tinker)"
        elif name == "tuned":
            if not run:
                print("  skip: no run.json (train first)"); continue
            outs, label = asyncio.run(run_tinker(run["model_path"], examples)), "Qwen3-8B + PF Desk LoRA (Tinker)"
        elif name == "gemma":
            outs, label = run_ollama(a.gemma_model, examples, fewshot()), f"{a.gemma_model} few-shot (Ollama, laptop)"
        elif name == "local":
            outs, label = run_ollama(a.local_model, examples, [], LOCAL), "Qwen3-8B Q4 + PF Desk LoRA (llama-server, laptop)"
        else:
            raise SystemExit(f"unknown system {name}")
        r = score(examples, outs)
        r["cost_per_1k_usd"] = round(r["tokens_per_remark"] * 1000 / 1e6 * SAMPLE_PRICE_PER_M, 3) if name in ("base", "tuned") else 0.0
        results[label] = r
        with (DATA / f"pred_{name}{'_public' if public else ''}.jsonl").open("w", encoding="utf-8") as fh:
            for ex, o in zip(examples, outs):
                fh.write(json.dumps({"remark": ex["messages"][1]["content"], "gold": target(ex), "raw": o[0], "pred": parse(o[0]), "latency": o[1], "tokens": o[2]}, ensure_ascii=False) + "\n")
        print(json.dumps(r, indent=1))
    (write_public_report if public else write_report)(results, len(examples), run)


def write_public_report(results: dict[str, dict], n: int, run: dict | None) -> None:
    out = HERE.parent.parent / "evaluation" / "decoder_public.md"
    rows = [f"| {k} | {r['macro_f1']:.3f} | {r['accuracy']:.0%} | {r['accuracy_alt_ok']:.0%} | {r['json_valid']:.0%} | {r['schema_strict']:.0%} | {r['p50_latency_s']:.2f}s |" for k, r in results.items()]
    prev = out.read_text(encoding="utf-8") if out.exists() else ""  # keep rows of systems not re-run
    rows += [l for l in prev.splitlines() if l.startswith("| ") and not l.startswith("| System") and l.split(" | ")[0][2:] not in results]
    out.write_text(f"""# Rejection Decoder on real public EPFO remarks

Updated {time.strftime('%Y-%m-%d %H:%M')} · {n} remark texts that members and articles posted publicly (`ml/decoder/data/public_remarks.jsonl`, sources per row, labelled by us from the source's own explanation; see `public_remarks.md`). **Never used for training.** This is the honest out-of-distribution check: the decoder was trained only on synthetic remarks.

| System | Macro-F1 | Accuracy | Accuracy (2nd label ok) | Usable JSON | Strict schema | p50 latency |
|---|---|---|---|---|---|---|
{chr(10).join(rows)}

"Usable JSON": known category (invented field / fix-step names are dropped, as the app does). "Strict schema": no invented names at all. "2nd label ok": for remarks marked ambiguous, the labeller's alternative category also counts as correct.
""", encoding="utf-8")
    print("wrote", out)


def write_report(results: dict[str, dict], n: int, run: dict | None) -> None:
    out = HERE.parent.parent / "evaluation" / "decoder.md"
    prev = out.read_text(encoding="utf-8") if out.exists() else ""
    rows = [f"| {k} | {r['macro_f1']:.3f} | {r['f1_clean']:.3f} | {r['f1_noisy']:.3f} | {r['f1_hard']:.3f} | {r['json_valid']:.0%} | {r['fields_jaccard']:.2f} | {r['fix_jaccard']:.2f} | {r['p50_latency_s']:.2f}s | ${r['cost_per_1k_usd']:.3f} |" for k, r in results.items()]
    # keep rows from earlier runs of systems not re-run this time
    old = [line for line in prev.splitlines() if line.startswith("| ") and not line.startswith("| System") and not line.startswith("|---") and line.split(" | ")[0][2:] not in results]
    md = f"""# Rejection Decoder evaluation

Updated {time.strftime('%Y-%m-%d %H:%M')} · test set: {n} examples from `ml/decoder/data/test.jsonl` ({len(CATEGORIES)} categories; clean originals + noisy copies; 25 hard groups). Split is grouped by source remark, so no remark or its augmentations appear in both train and test.

**Data is synthetic** (template grammar + hand-written EPFO-style remarks, see `ml/decoder/data/README.md`). Template phrasing overlaps between groups, so these scores are optimistic for real portal remarks — retrain and re-run on the consultant's labelled remarks (label tool at `/label`).

| System | Macro-F1 | F1 clean | F1 noisy | F1 hard | JSON valid | Fields Jaccard | Fix-step Jaccard | p50 latency | Cost / 1k remarks |
|---|---|---|---|---|---|---|---|---|---|
{chr(10).join(rows + old)}

Latency: Tinker rows are remote API round-trips (32 concurrent); laptop rows are local CPU inference, one at a time. Cost: Tinker sampling at ${SAMPLE_PRICE_PER_M}/M tokens (prompt + output); local models cost nothing per call.

Training: {json.dumps(run) if run else 'not run yet'}
"""
    out.write_text(md, encoding="utf-8")
    print("wrote", out)


if __name__ == "__main__":
    main()
