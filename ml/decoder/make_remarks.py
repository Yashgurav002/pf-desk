"""T3.2 Seed remark pool -> data/remarks.jsonl (synthetic, deterministic, stdlib only).

Sources: the 40 REMARKS from apps/api/src/synthetic.ts, a per-category template grammar,
generated multi-problem remarks (main = first problem mentioned), and hand-written vague `other` remarks.
Run: python -I make_remarks.py
"""
import itertools, json, random, re
from pathlib import Path

HERE = Path(__file__).resolve().parent
LABELS = json.loads((HERE / "labels.json").read_text(encoding="utf-8"))["categories"]
rng = random.Random(42)
PER_CATEGORY = 28  # template remarks per category (plus originals + multi-problem)

# (a) copied verbatim from apps/api/src/synthetic.ts REMARKS
ORIGINAL = [
    ("NAME MISMATCH WITH BANK A/C", "name_mismatch"),
    ("Member name not matching as per bank records", "name_mismatch"),
    ("NAME OF MEMBER DIFFERS IN UAN & AADHAAR", "name_mismatch"),
    ("name in cheque leaf not legible/not matching", "name_mismatch"),
    ("FATHER'S NAME MISMATCH", "father_name_mismatch"),
    ("Father/husband name not as per records. pls correct thru JD", "father_name_mismatch"),
    ("F/NAME DIFFERS IN BANK & EPFO RECORD", "father_name_mismatch"),
    ("DOB MISMATCH AS PER AADHAAR", "dob_mismatch"),
    ("Date of birth not matching with UIDAI data", "dob_mismatch"),
    ("D.O.B. DIFFERENT IN CLAIM & MEMBER PROFILE", "dob_mismatch"),
    ("INVALID IFSC CODE", "bank_details_invalid"),
    ("Bank a/c no. incorrect / a/c closed. Submit correct details", "bank_details_invalid"),
    ("BANK ACCOUNT INACTIVE/FROZEN", "bank_details_invalid"),
    ("BANK KYC NOT VERIFIED", "bank_not_verified"),
    ("Bank details not verified by bank. Pls get verified", "bank_not_verified"),
    ("BANK A/C PENDING FOR VERIFICATION AT BANK END", "bank_not_verified"),
    ("CHEQUE IMAGE NOT CLEAR", "cheque_image_unclear"),
    ("uploaded cheque/passbook blurred, a/c no & IFSC not visible", "cheque_image_unclear"),
    ("CANCELLED CHQ NOT LEGIBLE PL RESUBMIT", "cheque_image_unclear"),
    ("KYC NOT APPROVED BY EMPLOYER", "kyc_not_approved"),
    ("Pending KYC at employer level", "kyc_not_approved"),
    ("AADHAAR NOT SEEDED WITH UAN", "aadhaar_not_linked"),
    ("Aadhaar not verified/linked. UIDAI verification failed", "aadhaar_not_linked"),
    ("DOE NOT AVAILABLE", "exit_date_missing"),
    ("Date of exit not updated by establishment", "exit_date_missing"),
    ("DT OF LEAVING NOT MARKED IN SERVICE HISTORY", "exit_date_missing"),
    ("SERVICE LESS THAN REQUIRED FOR WITHDRAWAL", "service_ineligible"),
    ("Member not eligible as per para 68 - service insufficient", "service_ineligible"),
    ("NOT ELIGIBLE: 2 MONTHS NOT COMPLETED FROM DOE", "waiting_period"),
    ("claim filed before completion of waiting period", "waiting_period"),
    ("PURPOSE NOT ADMISSIBLE", "purpose_ineligible"),
    ("Advance purpose not covered / documents for purpose not attached", "purpose_ineligible"),
    ("CLAIM ALREADY SETTLED", "duplicate_claim"),
    ("Duplicate claim. Earlier claim under process", "duplicate_claim"),
    ("SAME CLAIM ALREADY SUBMITTED - REJECTED AS DUPLICATE", "duplicate_claim"),
    ("SIGNATURE NOT MATCHING", "signature_or_photo"),
    ("Photo not clear / signature missing on form", "signature_or_photo"),
    ("MEMBER DETAILS NOT FOUND, CONTACT ESTT", "other"),
    ("Rejected. Refer to estt for clarification", "other"),
    ("PL SUBMIT FRESH CLAIM WITH CORRECT DETAILS", "other"),
]

# (b) template grammar. Slots in {BRACES} expand from S (or the category's own slot dict).
S = {
    "SFX": ["", "", "", " PL RESUBMIT", ". PLS RESUBMIT", " - SUBMIT FRESH CLAIM", ". REFILE AFTER CORRECTION",
            " PL. CORRECT & RESUBMIT", ", CONTACT ESTT", " W.R.T. RECORDS"],
    "SRC": ["AADHAAR", "BANK A/C", "BANK RECORDS", "PAN", "UAN", "KYC DOCS", "EPFO RECORDS", "UIDAI DATA"],
    "ACC": ["BANK A/C", "A/C NO", "AC NO", "BANK ACCOUNT NO", "ACCOUNT NUMBER", "SB A/C", "BANK A/C NO."],
    "DOE": ["DOE", "D.O.E", "DATE OF EXIT", "DT OF EXIT", "DOL", "DATE OF LEAVING", "DT OF LEAVING"],
}
G = {
    "name_mismatch": ({"N": ["NAME", "MEMBER NAME", "MBR NAME", "NAME OF MEMBER", "EMP NAME", "MEMBER'S NAME"]}, [
        "{N} MISMATCH WITH {SRC}{SFX}", "{N} NOT MATCHING AS PER {SRC}{SFX}", "SPELLING OF {N} DIFFERS FROM {SRC}{SFX}",
        "{N} IN CLAIM NOT SAME AS {SRC}{SFX}", "{N} DIFFERS IN CLAIM & {SRC}", "MISMATCH IN {N} W.R.T. {SRC}{SFX}",
        "INITIALS IN {N} NOT EXPANDED AS PER {SRC}", "{N} AS PER {SRC} NOT MATCHING CLAIM FORM",
    ]),
    "father_name_mismatch": ({"F": ["FATHER NAME", "FATHER'S NAME", "F/H NAME", "F/NAME", "FATHER/HUSBAND NAME",
                                    "FATHERS NAME", "F.NAME"]}, [
        "{F} MISMATCH{SFX}", "{F} NOT MATCHING WITH {SRC}{SFX}", "{F} DIFFERS IN {SRC} & MEMBER PROFILE",
        "{F} NOT AS PER RECORDS{SFX}", "{F} BLANK/INCORRECT IN MEMBER PROFILE", "CORRECT {F} THRU JD{SFX}",
        "MBR {F} DIFFERENT FROM {SRC}",
    ]),
    "dob_mismatch": ({"D": ["DOB", "D.O.B", "D.O.B.", "DATE OF BIRTH", "DT OF BIRTH", "BIRTH DATE"]}, [
        "{D} MISMATCH WITH {SRC}{SFX}", "{D} NOT MATCHING WITH UIDAI DATA{SFX}", "{D} IN CLAIM DIFFERS FROM MEMBER PROFILE",
        "{D} DIFFERENT IN CLAIM & {SRC}", "INCORRECT {D}, GET IT CORRECTED THRU JD", "{D} AS PER {SRC} NOT SAME AS CLAIM",
        "MISMATCH IN {D}{SFX}",
    ]),
    "bank_details_invalid": ({"I": ["IFSC", "IFSC CODE", "IFS CODE"]}, [
        "INVALID {I}{SFX}", "{I} INVALID / NOT EXISTING{SFX}", "{ACC} INCORRECT{SFX}", "{ACC} CLOSED{SFX}",
        "{ACC} INACTIVE/DORMANT{SFX}", "{ACC} FROZEN BY BANK{SFX}", "{I} & {ACC} NOT CORRESPONDING",
        "BANK MERGED, OLD {I} NOT VALID{SFX}", "NEFT RETURNED - {ACC} DOES NOT EXIST", "WRONG {I} ENTERED{SFX}",
        "JOINT {ACC} NOT ALLOWED{SFX}", "{ACC} DIGITS INCOMPLETE{SFX}",
    ]),
    "bank_not_verified": ({"B": ["BANK A/C", "BANK DETAILS", "BANK KYC", "BANK ACCOUNT", "A/C DETAILS"]}, [
        "{B} NOT VERIFIED BY BANK{SFX}", "{B} PENDING FOR VERIFICATION AT BANK END", "{B} UNVERIFIED IN UAN{SFX}",
        "BANK VERIFICATION OF {B} PENDING{SFX}", "{B} AWAITING VERIFICATION FROM BANK", "{B} NOT YET VERIFIED{SFX}",
        "{B} SEEDED BUT NOT VERIFIED", "VERIFICATION OF {B} NOT DONE BY BANK",
    ]),
    "cheque_image_unclear": ({"C": ["CHEQUE", "CHQ", "CANCELLED CHQ", "CANCELLED CHEQUE", "CHEQUE LEAF", "PASSBOOK",
                                    "PASSBOOK COPY", "CHQ LEAF"]}, [
        "{C} IMAGE NOT CLEAR{SFX}", "{C} NOT LEGIBLE{SFX}", "UPLOADED {C} BLURRED{SFX}",
        "{C} UNCLEAR, A/C NO NOT VISIBLE", "IFSC NOT VISIBLE ON {C}{SFX}", "UNCLEAR {C} UPLOADED{SFX}",
        "{C} IMAGE CUT/INCOMPLETE{SFX}", "{C} SCAN NOT READABLE",
    ]),
    "kyc_not_approved": ({"K": ["KYC", "BANK KYC", "PAN KYC", "KYC DETAILS", "KYC (BANK)"],
                          "E": ["EMPLOYER", "ESTT", "EMPLOYER LEVEL", "ESTABLISHMENT", "EMP"]}, [
        "{K} NOT APPROVED BY {E}{SFX}", "{K} PENDING AT {E}", "{K} PENDING FOR APPROVAL BY {E}",
        "{K} NOT DIGITALLY SIGNED BY {E}", "{E} HAS NOT APPROVED {K}{SFX}", "DSC APPROVAL OF {K} PENDING WITH {E}",
        "{K} AWAITING {E} APPROVAL",
    ]),
    "aadhaar_not_linked": ({"A": ["AADHAAR", "AADHAR", "ADHAR", "AADHAAR NO", "UID"]}, [
        "{A} NOT SEEDED WITH UAN{SFX}", "{A} NOT LINKED{SFX}", "UAN NOT LINKED WITH {A}{SFX}",
        "{A} NOT VERIFIED BY UIDAI", "{A} VERIFICATION PENDING{SFX}", "{A} NOT AVAILABLE IN UAN{SFX}",
        "E-KYC OF {A} NOT DONE", "UIDAI VERIFICATION OF {A} FAILED", "{A} SEEDING PENDING",
    ]),
    "exit_date_missing": ({}, [
        "{DOE} NOT AVAILABLE{SFX}", "{DOE} NOT UPDATED BY ESTT{SFX}", "{DOE} NOT MARKED IN SERVICE HISTORY",
        "{DOE} BLANK{SFX}", "MBR STILL IN SERVICE AS PER RECORDS, {DOE} NOT MARKED", "{DOE} NOT ENTERED BY EMPLOYER",
        "{DOE} & REASON OF EXIT NOT UPDATED", "{DOE} NOT FOUND IN UAN{SFX}",
    ]),
    "service_ineligible": ({"Y": ["5 YRS", "7 YRS", "6 MONTHS", "5 YEARS", "7 YEARS"],
                            "P": ["HOUSING ADVANCE", "MARRIAGE ADVANCE", "EDUCATION ADVANCE", "PURPOSE 31",
                                  "WITHDRAWAL", "FORM 31 ADVANCE"]}, [
        "SERVICE LESS THAN {Y} FOR {P}{SFX}", "MEMBERSHIP LESS THAN {Y}{SFX}", "INSUFFICIENT SERVICE FOR {P}",
        "MBR HAS NOT COMPLETED {Y} SERVICE FOR {P}", "REQUIRED SERVICE OF {Y} NOT COMPLETED{SFX}",
        "NOT ELIGIBLE, MEMBERSHIP BELOW {Y} FOR {P}", "ELIGIBLE SERVICE NOT COMPLETED FOR {P}",
    ]),
    "waiting_period": ({"W": ["2 MONTHS", "60 DAYS", "TWO MONTHS", "2 MNTHS"]}, [
        "{W} NOT COMPLETED FROM {DOE}{SFX}", "CLAIM FILED BEFORE {W} OF {DOE}", "MBR NOT UNEMPLOYED FOR {W}{SFX}",
        "WAITING PERIOD OF {W} NOT OVER{SFX}", "CLAIM SUBMITTED WITHIN {W} OF LEAVING", "PREMATURE CLAIM - {W} NOT ELAPSED SINCE {DOE}",
        "MEMBER HAS NOT COMPLETED {W} UNEMPLOYMENT{SFX}",
    ]),
    "purpose_ineligible": ({"P": ["MARRIAGE", "HOUSE CONSTRUCTION", "MEDICAL", "EDUCATION", "HOUSING LOAN REPAYMENT",
                                  "PLOT PURCHASE"],
                            "DOC": ["INVITATION CARD", "MEDICAL CERTIFICATE", "ESTIMATE", "SALE AGREEMENT",
                                    "FEE RECEIPT", "LOAN STATEMENT"]}, [
        "PURPOSE NOT ADMISSIBLE{SFX}", "ADVANCE FOR {P} NOT ADMISSIBLE{SFX}", "{DOC} FOR {P} NOT ATTACHED",
        "{P} ADVANCE: {DOC} NOT ENCLOSED{SFX}", "INCORRECT PARA SELECTED FOR {P} ADVANCE", "PURPOSE OF ADVANCE NOT COVERED{SFX}",
        "MAX NO. OF ADVANCES FOR {P} ALREADY AVAILED", "AMOUNT CLAIMED EXCEEDS LIMIT FOR {P}",
        # v3: wrong para / wrong form for the situation
        "NOT ELIGIBLE UNDER THIS PARA, APPLY UNDER CORRECT PARA{SFX}", "{DOE} ALREADY MARKED, APPLY FINAL SETTLEMENT NOT ADVANCE",
        "ESTT IS FUNCTIONING, ADVANCE UNDER THIS PARA NOT ADMISSIBLE", "MEMBER HAS LEFT SERVICE, SUBMIT FORM 19 / TRANSFER INSTEAD",
    ]),
    "duplicate_claim": ({"C": ["CLAIM", "FORM 19 CLAIM", "FORM 10C CLAIM", "FORM 31 CLAIM", "PF CLAIM", "FINAL SETTLEMENT"]}, [
        "{C} ALREADY SETTLED{SFX}", "DUPLICATE {C}{SFX}", "EARLIER {C} UNDER PROCESS", "SAME {C} ALREADY SUBMITTED",
        "ANOTHER {C} PENDING FOR SAME MEMBER ID", "{C} ALREADY PAID TO MEMBER", "PREVIOUS {C} PENDING, CANNOT PROCESS",
        "{C} REJECTED AS DUPLICATE{SFX}",
    ]),
    "signature_or_photo": ({"SG": ["SIGNATURE", "SIGN", "MBR SIGNATURE", "MEMBER SIGN", "SIGNATURE OF MEMBER"],
                            "PH": ["PHOTO", "PHOTOGRAPH", "MBR PHOTO", "PASSPORT PHOTO"]}, [
        "{SG} NOT MATCHING{SFX}", "{SG} MISSING ON FORM{SFX}", "{PH} NOT CLEAR{SFX}", "{PH} NOT ATTACHED{SFX}",
        "{SG} NOT LEGIBLE{SFX}", "{PH} NOT UPLOADED", "{SG} DIFFERS FROM RECORDS", "FORM NOT SIGNED, {PH} ALSO MISSING",
        "{PH} NOT ATTESTED BY ESTT",
    ]),
    # added 2026-10-15 after the public-remarks study (43% of real remarks fit none of the first 15); own wording, not copied
    "pension_eps_issue": ({"E": ["EPS", "PENSION", "PENSION FUND", "EPS SHARE", "PENSION CONTRIBUTION"]}, [
        "MEMBER NOT ELIGIBLE FOR {E} AS JOINED AFTER 09/2014 WITH WAGES ABOVE 15000{SFX}", "{E} REMITTED FOR NON EPS MEMBER{SFX}",
        "{E} DEDUCTED AFTER AGE 58, CLARIFY{SFX}", "{E} SERVICE DETAILS NOT AVAILABLE{SFX}", "{E} WAGES EXCEED CEILING WITHOUT JOINT OPTION",
        "EXCESS {E} REMITTED, ESTT TO REVISE{SFX}", "{E} NOT REMITTED FOR EPS MEMBER{SFX}", "CLARIFY {E} MEMBERSHIP{SFX}",
        "{E} PART SHOWN IN EMPLOYER SHARE{SFX}",
    ]),
    "contribution_missing": ({"C": ["CONTRIBUTION", "CONT", "CONTRI", "PF CONTRIBUTION", "ECR"]}, [
        "{C} NOT RECEIVED FOR SOME MONTHS{SFX}", "{C} GAP BETWEEN DOJ AND {DOE}{SFX}", "{C} NOT RECONCILED{SFX}",
        "{C} PENDING RECONCILIATION, APPLY LATER", "LAST {C} NOT RECEIVED FROM ESTT", "{C} DETAILS MISMATCH IN LEDGER{SFX}",
        "{C} RECEIVED ONLY UPTO PREVIOUS YEAR{SFX}", "NCP DAYS NOT GIVEN, {C} IRREGULAR", "EE/ER {C} DIFFER{SFX}",
        # v3: reconciliation / ECR revision wording
        "CLAIM ON HOLD TILL {C} RECONCILATION", "{C} REVISION UNDER PROCESS, APPLY AFTERWARDS", "LEDGER NOT UPDATED, {C} RECONCILIATION AWAITED",
        "LAST WAGES NOT AVAILABLE, {C} NOT POSTED",
    ]),
    "transfer_pending": ({"T": ["TRANSFER", "TRANSFER-IN", "PREVIOUS SERVICE", "PREV MEMBER ID", "OLD PF A/C"]}, [
        "{T} PENDING{SFX}", "{T} NOT YET RECEIVED{SFX}", "SETTLE {T} FIRST THEN APPLY", "{T} OVERLAPS PRESENT SERVICE",
        "MULTIPLE MEMBER IDS, COMPLETE {T}{SFX}", "{T} PENDING AT OTHER REGIONAL OFFICE", "SERVICE OVERLAP WITH {T}{SFX}",
        "{T} DETAILS TO BE VERIFIED{SFX}",
    ]),
    "tax_pan_15g": ({"X": ["FORM 15G", "15G/15H", "FORM 15H", "PAN", "PAN CARD"]}, [
        "{X} NOT SUBMITTED, TDS APPLICABLE", "SERVICE BELOW 5 YRS, SUBMIT {X}{SFX}", "{X} NOT FURNISHED{SFX}",
        "UPLOAD {X} TO AVOID TDS", "{X} REQUIRED AS AMOUNT ABOVE 50000{SFX}", "{X} INVALID / NOT SEEDED{SFX}",
        "TDS TO BE DEDUCTED, {X} MISSING",
    ]),
    "employer_confirmation": ({"L": ["GENUINENESS LETTER", "EMPLOYER CONFIRMATION", "CONFIRMATION FROM ESTT", "EMPLOYER CERTIFICATE"]}, [
        "{L} REQUIRED{SFX}", "HIGH VALUE CLAIM, {L} AWAITED", "{L} NOT RECEIVED{SFX}", "SUBMIT {L} AND RESUBMIT",
        "CLAIM ON HOLD FOR {L}", "{L} PENDING FROM EMPLOYER{SFX}",
    ]),
}

# hand-written vague / unusual remarks -> other
OTHER = [
    "REJECTED AS PER RULES", "CONTACT REGIONAL OFFICE", "RETURNED - OTHERS", "NOT AS PER GUIDELINES",
    "CLAIM REJECTED: OTHERS", "System error, pl resubmit", "AS PER RO DIRECTION", "Under scrutiny, reasons to follow",
    "MEMBER ID NOT FOUND", "ESTT CODE NOT ACTIVE", "Mbr deceased, settle thru form 20", "MOBILE NO NOT ACTIVE IN UAN", "INCOMPLETE CLAIM",
    "Details incomplete pl check and resubmit", "Rejected - see remarks", "OTHERS", "CLAIM NOT IN ORDER",
    "ESTT UNDER INQUIRY, CLAIM ON HOLD", "MEMBER ID MAPPED TO WRONG UAN", "Return to member for correction",
    "NIL BALANCE IN A/C", "INTEREST NOT UPDATED IN PASSBOOK, RESUBMIT LATER", "PENSION ALREADY COMMENCED",
    "Refer to helpdesk", "Form 10D required instead of 10C",
]

# multi-problem: short phrase per category, main = first problem mentioned
SHORT = {
    "name_mismatch": ["NAME MISMATCH", "MBR NAME NOT MATCHING", "NAME DIFFERS IN AADHAAR"],
    "father_name_mismatch": ["F/H NAME MISMATCH", "FATHER NAME NOT MATCHING", "F/NAME INCORRECT"],
    "dob_mismatch": ["DOB MISMATCH", "D.O.B NOT MATCHING", "DATE OF BIRTH DIFFERS"],
    "bank_details_invalid": ["IFSC INVALID", "A/C NO INCORRECT", "BANK A/C CLOSED"],
    "bank_not_verified": ["BANK A/C NOT VERIFIED BY BANK", "BANK VERIFICATION PENDING", "BANK KYC NOT VERIFIED"],
    "cheque_image_unclear": ["CHQ NOT LEGIBLE", "CHEQUE IMAGE BLURRED", "PASSBOOK COPY NOT CLEAR"],
    "kyc_not_approved": ["KYC NOT APPROVED BY EMPLOYER", "KYC PENDING AT ESTT", "EMPLOYER KYC APPROVAL PENDING"],
    "aadhaar_not_linked": ["AADHAAR NOT SEEDED", "UAN NOT LINKED WITH AADHAAR", "AADHAAR NOT VERIFIED"],
    "exit_date_missing": ["DOE NOT AVAILABLE", "DATE OF EXIT NOT MARKED", "DOL NOT UPDATED BY ESTT"],
    "service_ineligible": ["SERVICE LESS THAN 5 YRS", "MEMBERSHIP INSUFFICIENT", "SERVICE NOT COMPLETED"],
    "waiting_period": ["2 MONTHS NOT COMPLETED FROM DOE", "WAITING PERIOD NOT OVER", "60 DAYS NOT ELAPSED"],
    "purpose_ineligible": ["PURPOSE NOT ADMISSIBLE", "DOCS FOR PURPOSE NOT ATTACHED", "ADVANCE PURPOSE NOT COVERED"],
    "duplicate_claim": ["CLAIM ALREADY SETTLED", "DUPLICATE CLAIM", "EARLIER CLAIM UNDER PROCESS"],
    "signature_or_photo": ["SIGNATURE NOT MATCHING", "PHOTO NOT CLEAR", "SIGN MISSING ON FORM"],
    "pension_eps_issue": ["NOT AN EPS MEMBER", "EPS REMITTED WRONGLY", "PENSION SHARE CLARIFY"],
    "contribution_missing": ["CONT NOT RECEIVED", "CONTRIBUTION GAP", "ECR NOT RECONCILED"],
    "transfer_pending": ["TRANSFER-IN PENDING", "PREV SERVICE NOT TRANSFERRED", "SERVICE OVERLAP"],
    "tax_pan_15g": ["FORM 15G NOT SUBMITTED", "PAN NOT FURNISHED", "TDS APPLICABLE, PAN MISSING"],
    "employer_confirmation": ["GENUINENESS LETTER REQUIRED", "EMPLOYER CONFIRMATION AWAITED", "ESTT CONFIRMATION PENDING"],
}
JOIN = [" & ", ", ", " AND ", "; ALSO ", ". ", " / ", " + "]
FUSED = [  # hand-written fused multi-problem remarks: (text, main, extra categories)
    ("NAME & DOB MISMATCH WITH AADHAAR", "name_mismatch", ["dob_mismatch"]),
    ("NAME, DOB & F/H NAME NOT MATCHING AS PER AADHAAR", "name_mismatch", ["dob_mismatch", "father_name_mismatch"]),
    ("DOB & F/NAME DIFFERENT IN UAN AND AADHAAR", "dob_mismatch", ["father_name_mismatch"]),
    ("IFSC & A/C NO NOT VISIBLE, CHQ ALSO NOT SIGNED", "cheque_image_unclear", ["signature_or_photo"]),
    ("Signature and photo both not clear on form & cheque", "signature_or_photo", ["cheque_image_unclear"]),
    ("BANK A/C & AADHAAR BOTH NOT VERIFIED", "bank_not_verified", ["aadhaar_not_linked"]),
]

KEEP_UPPER = {"UAN", "IFSC", "KYC", "DOB", "DOE", "DOL", "PAN", "UIDAI", "EPFO", "JD", "NEFT", "DSC", "RO", "ID", "IDS",
              "UID", "PF", "SB", "A/C", "F/H", "TDS", "EPS", "ECR", "NCP", "EE/ER", "DOJ"}


def style(text):
    """CAPS (most EPFO remarks), sentence case, or lower case."""
    r = rng.random()
    if r < 0.55:
        return text
    low = text.lower()
    if r < 0.85:
        low = re.sub(r"[A-Za-z/]+", lambda m: m.group().upper() if m.group().upper() in KEEP_UPPER and rng.random() < 0.6 else m.group(), low)
        return low[:1].upper() + low[1:]
    return low


def expand(template, slots):
    keys = re.findall(r"\{(\w+)\}", template)
    pools = [slots.get(k) or S[k] for k in keys]
    out = []
    for combo in itertools.product(*pools):
        t = template
        for k, v in zip(keys, combo):
            t = t.replace("{%s}" % k, v, 1)
        out.append(t)
    rng.shuffle(out)
    return out


def labels_for(cats):
    fields, fix = [], []
    for c in cats:
        fields += LABELS[c]["fields"]
        fix += LABELS[c]["fix"]
    return sorted(set(fields)), sorted(set(fix))


def main():
    rows, seen = [], set()

    def add(text, cats):
        key = re.sub(r"\s+", " ", text.strip().lower())
        if key in seen:
            return False
        seen.add(key)
        fields, fix = labels_for(cats)
        n = len(rows) + 1
        rows.append({"id": f"r{n:04d}", "text": text, "category": cats[0], "fields_involved": fields,
                     "fix_step_ids": fix, "source": "synthetic", "group": f"g{n:04d}"})
        return True

    for text, cat in ORIGINAL:
        assert add(text, [cat]), text
    for cat, (slots, templates) in G.items():
        streams = [iter(expand(t, slots)) for t in templates]
        made = 0
        for t in itertools.cycle(streams):  # round-robin so every template shape is used
            nxt = next(t, None)
            if nxt is not None and add(style(nxt), [cat]):
                made += 1
            if made == PER_CATEGORY or all(s.__length_hint__() == 0 for s in streams):
                break
    for text in OTHER:
        add(text, ["other"])
    cats = list(SHORT)
    for main_cat in cats:
        for _ in range(3):
            extra = rng.sample([c for c in cats if c != main_cat], rng.choice([1, 1, 2]))
            parts = [rng.choice(SHORT[c]) for c in [main_cat] + extra]
            text = parts[0] + "".join(rng.choice(JOIN) + p for p in parts[1:])
            add(style(text), [main_cat] + extra)
    for text, main_cat, extra in FUSED:
        add(text, [main_cat] + extra)

    out = HERE / "data" / "remarks.jsonl"
    out.parent.mkdir(exist_ok=True)
    out.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    counts = {}
    for r in rows:
        counts[r["category"]] = counts.get(r["category"], 0) + 1
    print(f"{len(rows)} remarks -> {out}")
    for c in LABELS:
        print(f"  {c:22s} {counts.get(c, 0)}")


if __name__ == "__main__":
    main()
