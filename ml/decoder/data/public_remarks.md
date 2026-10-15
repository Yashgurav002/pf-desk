# Public EPFO rejection remarks

File: `public_remarks.jsonl`, 148 distinct remarks collected 2026-10-15. Each row has `text`, `category`, an optional `ambiguous`/`alt` pair, `kind`, `source_url`, `source_date`, and an optional `note`.

## Counts

| kind | n |
|---|---|
| member_post | 129 |
| article | 19 |

| category | n |
|---|---|
| other | 63 |
| purpose_ineligible | 14 |
| cheque_image_unclear | 14 |
| service_ineligible | 11 |
| exit_date_missing | 11 |
| bank_details_invalid | 9 |
| father_name_mismatch | 6 |
| name_mismatch | 6 |
| signature_or_photo | 3 |
| dob_mismatch | 3 |
| kyc_not_approved | 3 |
| bank_not_verified | 2 |
| duplicate_claim | 1 |
| waiting_period | 1 |
| aadhaar_not_linked | 1 |

31 rows are marked `ambiguous` and carry an `alt` category.

## Sources

- **Member posts:** all 129 come from the reader comment thread under bemoneyaware.com/epf-claim-rejection-pf/, which has about 919 comments dated 2021 to 2025. Members paste their portal remark there and ask for help.
- **Articles:**
  - labourlawadvisor.in (Jan 2020): 9 remarks
  - righttoinformation.wiki (Sep 2026): 8 remarks
  - paisatools.co.in (Sep 2026): 1 remark
  - The Ken (Mar 2024): 1 remark, the cryptic "ABC" that a consultant quoted
- **Searched without usable verbatim results:** Reddit, Quora, X/EPFO replies, outlookmoney, businesstoday, cleartax, zeebiz, pensionbazaar and epfprocess. They returned nothing verbatim, returned only paraphrases, or blocked the fetch (403/402/500). Two Quora questions only repeated remarks already in the file ("Not Eligible, Insufficient Service" and "father's name differs").

## Findings for the decoder

- **The biggest real-world bucket has no category.** "other" covers 43% of the rows, and most of them are EPS/pension membership problems, contribution or ECR gaps, higher-wage para 26(6) joint declarations, TDS/15G/PAN, transfer-in pending and reconciliation. Possible new categories: `eps_membership_clarify`, `contribution_missing`, `transfer_pending`, `tds_15g_pan`, `wrong_form`.
- **Remarks often hold two problems.** Real remarks often join two issues with a numbered "2)", for example "...2) FATHERs NAME DIFFERS". The prompt rule "pick the main one" matters here.
- **Remarks are messy.** They are abbreviated and misspelled ("CONT RCVD UPTO05/17SUB DLY SUBSN CLRIFY", "SERIVCE", "PARENTLESIS"), so the decoder must survive noise.
- **"CLAIM ALREADY SETTLED" is usually not a real duplicate claim.** It mostly appears as a second line after the PF part was paid and the EPS part was rejected, so the label `duplicate_claim` can mislead.

## Caveats

- **Selection bias:** one blog comment thread dominates the member posts. It skews toward pension (Form 10C) and older (2021–2023) remarks, before the 2025 changes: the cheque-image waiver, member-entered exit dates, and auto-settlement. Remarks about Aadhaar linking and bank verification are under-represented compared with what the news says is common.
- **Transcription risk:** the comment text came through a fetch-and-extract step. It was requested verbatim, but small character differences are possible, so spot-check against the page before using any row as a gold test item. Remarks that were cut off ("…") were skipped.
- **Article paraphrase risk:** the article rows are headings or quotes written by the author and may not match the exact portal wording, especially the righttoinformation.wiki and labourlawadvisor rows.
- **PII:** claim IDs, office/establishment codes and amounts were masked as XXXX. One office place name ("BOMMASANDRA OFFICE") and generic dates inside remark text were kept because they are not personal.
- **Labels:** the labels are mine, guided by the meaning in the thread or article where one was given. They were not checked by a consultant.
