# Kill-resume durability (Temporal)

`node src/durability.ts 20` on 2026-10-15: 20 MonthlyCycleWorkflow runs at CYCLE_FAST timing (1 "day" = 3s), worker hard-killed (SIGKILL / TerminateProcess) once per run at a random moment, restarted after 1-3 s.
Tasks are created by an idempotent activity keyed on `<workflow id>:<step>` (`tasks.dedupe_key` unique), so a replay or retry is a no-op.

**Result: 20/20 runs resumed and finished with exactly the expected tasks, 0 duplicates.**

| run | scenario | killed at | down | expected tasks | actual tasks | duplicate titles | result | |
|---|---|---|---|---|---|---|---|---|
| 1 | on_time | 7.8s | 1056ms | request, review | request, review | 0 | paid | PASS |
| 2 | late | 13.3s | 1705ms | request, chase, review, due | chase, due, request, review | 0 | paid | PASS |
| 3 | on_time | 29.1s | 2629ms | request, review | request, review | 0 | paid | PASS |
| 4 | late | 24.2s | 2207ms | request, chase, review, due | chase, due, request, review | 0 | paid | PASS |
| 5 | on_time | 3.9s | 1585ms | request, review | request, review | 0 | paid | PASS |
| 6 | late | 18.2s | 2961ms | request, chase, review, due | chase, due, request, review | 0 | paid | PASS |
| 7 | on_time | 17.6s | 2257ms | request, review | request, review | 0 | paid | PASS |
| 8 | late | 28.4s | 2914ms | request, chase, review, due | chase, due, request, review | 0 | paid | PASS |
| 9 | on_time | 1.6s | 2182ms | request, review | request, review | 0 | paid | PASS |
| 10 | late | 23.2s | 2655ms | request, chase, review, due | chase, due, request, review | 0 | paid | PASS |
| 11 | on_time | 14.8s | 1034ms | request, review | request, review | 0 | paid | PASS |
| 12 | late | 7.4s | 1338ms | request, chase, review, due | chase, due, request, review | 0 | paid | PASS |
| 13 | on_time | 25.1s | 2449ms | request, review | request, review | 0 | paid | PASS |
| 14 | late | 32.3s | 2185ms | request, chase, review, due | chase, due, request, review | 0 | paid | PASS |
| 15 | on_time | 24.0s | 2349ms | request, review | request, review | 0 | paid | PASS |
| 16 | late | 8.6s | 2329ms | request, chase, review, due | chase, due, request, review | 0 | paid | PASS |
| 17 | on_time | 7.9s | 1326ms | request, review | request, review | 0 | paid | PASS |
| 18 | late | 16.5s | 2288ms | request, chase, review, due | chase, due, request, review | 0 | paid | PASS |
| 19 | on_time | 12.9s | 2675ms | request, review | request, review | 0 | paid | PASS |
| 20 | late | 26.1s | 1205ms | request, chase, review, due | chase, due, request, review | 0 | paid | PASS |

Scenarios: `on_time` = sheet already in; validated on day 1, paid on day 14 (request, review). `late` = sheet arrives by signal after the chase; paid only after the due-day task (request, chase, review, payment due).
The test plays the consultant: the late sheet is signalled once the workflow reports a chasing/payment stage; on-time payment is signalled on day 14 by the clock (Temporal accepts signals while the worker is down).

History (same day): run 1 scored **17/20** — all 3 failures were a real bug: a salary sheet that arrived after the chase window was never validated (no "Review validation" task). Fixed in `workflows.ts` (a late sheet is validated whenever it arrives, even during the payment wait). Run 2 scored **18/20** — both failures were the test's fault (it waited for a stage query to pay, and the worker was dead at that moment, so payment landed after the due day). Fixed in `durability.ts`. Run 3: 20/20. Duplicates were 0 in every run.
