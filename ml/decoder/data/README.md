# Decoder data

All files are generated; rebuild with `python -I make_remarks.py && python -I build_dataset.py [--labels export.ndjson]` (stdlib only, fixed seeds, byte-identical reruns).

## Provenance
- `remarks.jsonl`: 484 **synthetic** base remarks, no personal data. Sources: the 40 hand-written `REMARKS` from `apps/api/src/synthetic.ts`; a per-category template grammar (EPFO-style caps/abbreviations, 26 per category); 32 hand-written vague remarks → `other`; 48 multi-problem remarks. Labels: `fields_involved`/`fix_step_ids` = union of the `labels.json` defaults of every category mentioned.
- Consultant labels (`--labels`, label-tool ndjson export) override a synthetic row with the same normalised text (lowercase, non-alphanumerics collapsed) and keep its group; new texts become their own group.

## Counts (synthetic only)
- Base remarks 484 = 484 groups → 339 train / 145 test groups, 25 test groups marked `hard`.
- `train.jsonl` 1,356 examples (each base remark + 3 augmented variants, `aug:true`).
- `test.jsonl` 290 examples = 145 clean originals + 145 light noisy copies (`aug:true`). Report scores on both (filter `aug`).
- Every category has 9–10 clean test remarks.

## Split rule
70/30 by `group`, stratified per category (seed 7); all variants of a remark stay on one side. Hard = top 25 test groups by score (multi-problem 3, `other` 2, +1 per unusual abbreviation like F/H, DOL, MBR, ESTT, UID, CHQ, DSC). Augmentations: case change, abbreviation swap, 1-char typo (words of 5+ letters), punctuation/spacing noise.

## Labelling rules
- Multi-problem: `category` = the **first** problem mentioned; fields/fixes = all problems.
- Service/membership length too short (incl. "service < 5 yrs for housing / Form 31 advance") → `service_ineligible`. `purpose_ineligible` only when the purpose itself is not admissible, its documents are missing, wrong para, limit exceeded, or the max number of advances for that purpose is used up.
- `waiting_period` = filed within 2 months / 60 days of exit (unemployment not completed). `exit_date_missing` = DOE/DOL not marked.
- `bank_details_invalid` = wrong/invalid IFSC or a/c no, a/c closed/inactive/frozen/joint, NEFT returned. `bank_not_verified` = details correct but bank verification pending. `cheque_image_unclear` = cheque/passbook upload not legible/blurred/cut.
- `kyc_not_approved` = anything pending **approval by the employer/estt** (incl. "bank KYC not approved by employer", DSC approval). "Bank KYC not verified" (no employer) → `bank_not_verified`.
- `duplicate_claim` = same claim already settled/submitted/under process; a previous **advance for the same purpose** is `purpose_ineligible`.
- Name/DOB/father mismatch "with Aadhaar" stays a mismatch category, not `aadhaar_not_linked`.
- Vague, procedural or uncovered reasons (transfer pending, ECR not filed, deceased → Form 20, PAN/TDS, "rejected as per rules") → `other` with empty lists.
