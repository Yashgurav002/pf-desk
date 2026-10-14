"""T3.3 Build the decoder SFT dataset -> data/train.jsonl, data/test.jsonl (chat format).

Inputs: data/remarks.jsonl (+ optional consultant labels via --labels export.ndjson; consultant wins on
the same normalised text). Grouped 70/30 split by `group`, stratified by category; 25 test groups marked hard.
Train gets ~3 noisy variants per base remark; test keeps the clean original + 1 noisy copy (aug=true).
Run: python -I build_dataset.py [--labels path]
"""
import argparse, json, random, re
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
LABELS = json.loads((HERE / "labels.json").read_text(encoding="utf-8"))
CATS, FIELDS = LABELS["categories"], set(LABELS["fields"])
FIXES = {f for c in CATS.values() for f in c["fix"]}
SYSTEM = (HERE / "system_prompt.txt").read_text(encoding="utf-8")
SEED, TEST_SHARE, N_HARD, N_TRAIN_AUG = 7, 0.3, 25, 3

# bidirectional abbreviation swaps (whole-word, case-insensitive)
ABBR = [("account", "a/c"), ("a/c no", "ac no"), ("date of birth", "dob"), ("dob", "d.o.b"), ("date of exit", "doe"),
        ("father name", "f/h name"), ("father's name", "f/name"), ("member", "mbr"), ("establishment", "estt"),
        ("estt", "employer"), ("cheque", "chq"), ("please", "pls"), ("pls", "pl."), ("aadhaar", "aadhar"),
        ("aadhaar", "adhar"), ("with", "w/"), ("and", "&"), ("years", "yrs"), ("months", "mnths"),
        ("signature", "sign"), ("through", "thru"), ("verified", "verfd"), ("as per", "acc to")]
UNUSUAL = re.compile(r"\b(f/h|f/name|f\.name|d\.o\.b|dol|mbr|estt|uid|adhar|aadhar|chq|dsc|mnths|w\.r\.t|ac no|e-kyc|neft|jd)\b", re.I)


def norm(text):
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text.lower()).split())


def check_label(r):
    assert r["category"] in CATS, r
    assert set(r["fields_involved"]) <= FIELDS and set(r["fix_step_ids"]) <= FIXES, r


def load(labels_path):
    rows = [json.loads(l) for l in (DATA / "remarks.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    by_norm = {norm(r["text"]): r for r in rows}
    if labels_path:
        for i, line in enumerate(Path(labels_path).read_text(encoding="utf-8").splitlines()):
            if not line.strip():
                continue
            c = json.loads(line)
            row = {"text": c["text"].strip(), "category": c["category"], "fields_involved": sorted(set(c.get("fields_involved") or [])),
                   "fix_step_ids": sorted(set(c.get("fix_step_ids") or [])), "source": c.get("source") or "consultant"}
            check_label(row)
            old = by_norm.get(norm(row["text"]))
            if old:  # consultant wins, keep the group so the split stays leak-free
                old.update(row)
            else:
                row["id"] = row["group"] = f"c{i + 1:04d}"
                rows.append(row)
                by_norm[norm(row["text"])] = row
    for r in rows:
        check_label(r)
    return rows


def is_multi(r):
    d = CATS[r["category"]]
    return set(r["fix_step_ids"]) != set(d["fix"]) or set(r["fields_involved"]) != set(d["fields"])


# --- augmentation ---------------------------------------------------------------------------------
def aug_case(t, rng):
    return rng.choice([t.upper(), t.lower(), t.title(), t.capitalize()])


def aug_abbr(t, rng):
    opts = []
    for a, b in ABBR:
        for src, dst in ((a, b), (b, a)):
            if re.search(r"(?<![\w/.])" + re.escape(src) + r"(?![\w/])", t, re.I):
                opts.append((src, dst))
    if not opts:
        return t
    src, dst = rng.choice(opts)
    return re.sub(r"(?<![\w/.])" + re.escape(src) + r"(?![\w/])", lambda m: dst.upper() if m.group().isupper() else dst, t, count=1, flags=re.I)


def aug_typo(t, rng):
    words = [m for m in re.finditer(r"[A-Za-z]{5,}", t)]
    if not words:
        return t
    m = rng.choice(words)
    w, i = m.group(), rng.randrange(1, len(m.group()) - 1)
    op = rng.choice(["swap", "drop", "dup"])
    w = w[:i] + w[i + 1] + w[i] + w[i + 2:] if op == "swap" else w[:i] + w[i + 1:] if op == "drop" else w[:i] + w[i] + w[i:]
    return t[:m.start()] + w + t[m.end():]


def aug_punct(t, rng):
    op = rng.choice(["strip", "spaces", "trail", "dash"])
    if op == "strip":
        return re.sub(r"[.,;:]", "", t)
    if op == "spaces":
        return re.sub(r" ", lambda _: rng.choice([" ", " ", "  "]), t).replace("/", rng.choice(["/", " / "]))
    if op == "trail":
        return t.rstrip(".") + rng.choice([".", "..", " -", ".PLS RESUBMIT", ""])
    return t.replace(", ", rng.choice([" - ", "; ", " , "]))


AUGS = [aug_case, aug_abbr, aug_typo, aug_punct]


def variants(text, n, rng):
    out, seen = [], {text}
    for _ in range(n * 10):
        t = text
        for f in rng.sample(AUGS, rng.choice([1, 2, 2, 3])):
            t = f(t, rng)
        t = " ".join(t.split()) if rng.random() < 0.7 else t.strip()
        if t not in seen:
            seen.add(t)
            out.append(t)
        if len(out) == n:
            break
    return out


# --- output ---------------------------------------------------------------------------------------
def example(r, text, hard, aug):
    target = json.dumps({"category": r["category"], "fields_involved": sorted(r["fields_involved"]),
                         "fix_step_ids": sorted(r["fix_step_ids"])}, separators=(",", ":"))
    return {"messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": f"Remark: {text}"},
                         {"role": "assistant", "content": target}],
            "category": r["category"], "group": r["group"], "hard": hard, "aug": aug, "source": r["source"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", help="consultant label export (ndjson)")
    args = ap.parse_args()
    rng = random.Random(SEED)
    rows = load(args.labels)

    groups = defaultdict(list)
    for r in rows:
        groups[r["group"]].append(r)
    by_cat = defaultdict(list)
    for g, rs in sorted(groups.items()):
        by_cat[rs[0]["category"]].append(g)
    test = set()
    for cat in sorted(by_cat):
        gs = by_cat[cat]
        rng.shuffle(gs)
        test.update(gs[:max(1, round(len(gs) * TEST_SHARE))])

    def hardness(g):
        r = groups[g][0]
        return 3 * is_multi(r) + 2 * (r["category"] == "other") + len(UNUSUAL.findall(r["text"]))
    cands = sorted(sorted(test), key=lambda g: (-hardness(g), rng.random()))
    hard = set(cands[:N_HARD])
    assert all(hardness(g) > 0 for g in hard), "not enough hard candidates in test"

    train_ex, test_ex = [], []
    for g in sorted(groups):
        for r in groups[g]:
            if g in test:
                test_ex.append(example(r, r["text"], g in hard, False))
                test_ex += [example(r, t, g in hard, True) for t in variants(r["text"], 1, rng)]
            else:
                train_ex.append(example(r, r["text"], False, False))
                train_ex += [example(r, t, False, True) for t in variants(r["text"], N_TRAIN_AUG, rng)]
    rng.shuffle(train_ex)

    # checks
    assert not ({e["group"] for e in train_ex} & {e["group"] for e in test_ex}), "group leak"
    for e in train_ex + test_ex:
        assert e["messages"][0]["content"] == SYSTEM
        y = json.loads(e["messages"][2]["content"])
        assert list(y) == ["category", "fields_involved", "fix_step_ids"] and y["category"] in CATS
        assert set(y["fields_involved"]) <= FIELDS and set(y["fix_step_ids"]) <= FIXES
    assert {e["category"] for e in test_ex} == set(CATS), "category missing from test"
    assert len(hard) == N_HARD

    for name, ex in (("train", train_ex), ("test", test_ex)):
        (DATA / f"{name}.jsonl").write_text("".join(json.dumps(e, ensure_ascii=False) + "\n" for e in ex), encoding="utf-8")
    tr, te = Counter(e["category"] for e in train_ex), Counter(e["category"] for e in test_ex)
    teo = Counter(e["category"] for e in test_ex if not e["aug"])
    print(f"base remarks {len(rows)} ({len(groups)} groups; {len(groups) - len(test)} train / {len(test)} test; {N_HARD} hard)")
    print(f"train {len(train_ex)} examples | test {len(test_ex)} examples ({len(test_ex) - sum(e['aug'] for e in test_ex)} clean + "
          f"{sum(e['aug'] for e in test_ex)} noisy; hard {sum(e['hard'] for e in test_ex)})")
    print(f"{'category':22s} {'train':>6s} {'test':>5s} {'test_clean':>10s}")
    for c in CATS:
        print(f"{c:22s} {tr[c]:6d} {te[c]:5d} {teo[c]:10d}")


if __name__ == "__main__":
    main()
