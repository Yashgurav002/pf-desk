"""LoRA SFT of the Rejection Decoder on Tinker (PRD §15). Needs TINKER_API_KEY.

    python -I tinker_train.py [--epochs 2] [--dry-run]

--dry-run tokenises the data and prints token/cost estimates without calling Tinker.
"""
import argparse
import asyncio
import csv
import json
import random
import time

import tinker
from tinker_cookbook import renderers
from tinker_cookbook.renderers import TrainOnWhat
from tinker_cookbook.hyperparam_utils import get_lr
from tinker_cookbook.supervised.common import compute_mean_nll
from tinker_cookbook.supervised.data import conversation_to_datum
from tinker_cookbook.tokenizer_utils import get_tokenizer

from common import BASE_MODEL, DATA, HERE, RENDERER, load

TRAIN_PRICE_PER_M = 0.44  # USD, Qwen3-8B on tinker models & pricing page, Oct 2026


async def main(epochs: int, batch: int, rank: int, dry_run: bool) -> None:
    tokenizer = get_tokenizer(BASE_MODEL)
    renderer = renderers.get_renderer(RENDERER, tokenizer)
    examples = load("train.jsonl")
    data = [conversation_to_datum(ex["messages"], renderer, max_length=1024, train_on_what=TrainOnWhat.LAST_ASSISTANT_MESSAGE) for ex in examples]
    tokens = sum(len(d.model_input.to_ints()) for d in data) * epochs
    print(f"{len(data)} examples x {epochs} epochs = {tokens:,} tokens, est ${tokens / 1e6 * TRAIN_PRICE_PER_M:.2f}")
    if dry_run:
        return

    lr = get_lr(BASE_MODEL)
    service = tinker.ServiceClient()
    trainer = await service.create_lora_training_client_async(base_model=BASE_MODEL, rank=rank)
    log_path = DATA / "train_log.csv"
    with log_path.open("w", newline="") as fh:
        log = csv.writer(fh)
        log.writerow(["step", "epoch", "loss", "seconds"])
        rng, step = random.Random(0), 0
        for epoch in range(epochs):
            order = list(range(len(data)))
            rng.shuffle(order)
            for i in range(0, len(order), batch):
                t = time.time()
                # submit both before awaiting so they land in the same Tinker clock cycle
                fb = await trainer.forward_backward_async([data[j] for j in order[i : i + batch]], loss_fn="cross_entropy")
                opt = await trainer.optim_step_async(tinker.AdamParams(learning_rate=lr))
                res = await fb.result_async()
                await opt.result_async()
                chunk = [data[j] for j in order[i : i + batch]]
                loss = compute_mean_nll([o["logprobs"] for o in res.loss_fn_outputs], [d.loss_fn_inputs["weights"] for d in chunk])
                step += 1
                log.writerow([step, epoch, round(loss, 4), round(time.time() - t, 1)])
                fh.flush()
                print(f"step {step} epoch {epoch} loss {loss:.4f}")

    saved = await (await trainer.save_weights_for_sampler_async(name="final")).result_async()
    run = {"model_path": saved.path, "base_model": BASE_MODEL, "renderer": RENDERER, "rank": rank, "lr": lr,
           "epochs": epochs, "batch": batch, "train_examples": len(data), "train_tokens": tokens,
           "est_cost_usd": round(tokens / 1e6 * TRAIN_PRICE_PER_M, 2), "finished": time.strftime("%Y-%m-%d %H:%M")}
    (HERE / "run.json").write_text(json.dumps(run, indent=2))
    print("saved", saved.path)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=2)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--rank", type=int, default=32)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    asyncio.run(main(a.epochs, a.batch, a.rank, a.dry_run))
