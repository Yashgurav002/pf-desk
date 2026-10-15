# Rule Book search (PRD §20 #6)

Updated 2026-10-15 14:06 · 30 questions (in `apps/api/src/bench-search.ts`) over the 34-embedded Rule Book seed.
Keyword = Postgres full-text ('simple'); vector = nomic-embed-text + pgvector cosine; hybrid = reciprocal rank fusion (k=60, keyword leg x3 when the query has a form number).

| Search | Recall@5 | MRR |
|---|---|---|
| keyword | 90% (27/30) | 0.803 |
| vector | 93% (28/30) | 0.861 |
| hybrid | 97% (29/30) | 0.838 |

Hybrid misses:
- "salary above 25000 is PF mandatory" → wanted R-WAGE-CEILING, got R-EPS-PENSION, R-TDS-PAN, R-WAITING-PERIOD, R-FORM-19, R-CONTRIBUTION
