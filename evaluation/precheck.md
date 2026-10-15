# Pre-check rules (PRD §20 #4)

Updated 2026-10-15 · synthetic employees from `synthetic.ts` (about 20% of clean names carry a harmless spelling variant — i/ee, v/w, u/oo — or bank-style CAPS that must NOT be flagged). Checked as of 2028-01-01 so waiting periods don't fire.

**Recall on planted errors: 800/800 (100.0%)**

| Planted error | Caught |
|---|---|
| name_mismatch | 100/100 |
| father_name_mismatch | 100/100 |
| dob_mismatch | 100/100 |
| bank_not_verified | 100/100 |
| kyc_not_approved | 100/100 |
| aadhaar_not_linked | 100/100 |
| ifsc_invalid | 100/100 |
| exit_date_missing | 100/100 |

**False alarms on 1000 clean claims: 0.0 per 100 claims** (0 claims with any flag).

Caveat: the generator and the checks were written by the same team, so this proves the rules fire as designed, not real-world accuracy. Real-world numbers need the consultant's confirmed flags (PRD §3).
