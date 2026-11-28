> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/rivendell-interstate (Rivendell Interstate Supervisory District, SU064) — FINDINGS

**Site:** https://www.rivendellschool.org/ (registry `http://www.rivendellschool.org/` is correct; redirects to https; no collector change staged). Budget docs: https://www.rivendellschool.org/voterinformation (also mirrored at nhrivendellisd.schoolinsites.com/budgets). Files are hosted on content.myconnectsuite.com.

## Structure
One budget-setting district (Rivendell Interstate School District, ud/rivendell-interstate; VT towns Fairlee, Vershire, West Fairlee + Orford NH). The union budget is voted once for the whole district ($16,604,487), then split by ADM: Orford NH 28.83%, Vermont (Unified) 71.17%. The AOE "VT Three Prior Years Comparisons" form covers the VERMONT share only. Warehouse records therefore carry the VT form's figures (Education Spending $8,846,318 for FY27), not the district-wide $16.6M. See needs_decision.

## Staged
- `intake/su-rivendell-interstate/fy2027/RISD 2026 Annual Report WEB.pdf` (2,394,163 bytes, 52 pp; sha256 36d12270…6266; filename from Content-Disposition). Source: https://content.myconnectsuite.com/api/documents/12cea5f7f5fd4882b70bf1b01dbeb326.pdf
- provenance.yaml; warehouse `fy2027-warned`, `fy2026-approved`, `fy2025-approved`, `fy2024-approved`. check_su.sh: 0 errors, no warning naming this SU.

## FY27 headline (PDF pages; printed page = PDF page - 3)
- Whole district (PDF pp. 9-10): Art. 4 budget $16,604,487; funds raised by taxes $12,690,084 ($12,240,084 after Art. 5's $450,000 fund-balance offset). Orford NH share: spending $4,298,945, assessment $3,523,515, est. rate $11.95/$1,000.
- VT form (PDF p. 16, stamped PRELIMINARY / ESTIMATES ONLY; read as image because text layer is garbled): union budget $12,305,543; revenues $3,459,225; **education spending $8,846,318**; LTWADM 537.29; per pupil $16,464.70; equalized rate $1.7873; income cap 2.51%.
- Town rates (PDF p. 15): Fairlee $1.4569 (adj. CLA 122.68%), West Fairlee $1.9446 (91.91%), Vershire $1.3480 (132.59%); unadjusted CLAs 86.28% / 64.64% / 93.25%.
- Prior columns (VT): FY26 $7,989,100 (LTWADM 551.18); FY25 $7,840,563 (564.99); FY24 $8,530,036 (296.43 equalized pupils, not comparable). All re-added; all match printed totals and per-pupil figures.
- FY26 budget (whole district $15,832,063) passed 148-123 on 2025-03-15 per the 2025 minutes in this report (PDF pp. 43-44) → adopted_date 2025-03-15.
- FY27 vote: result not stated in the document or found on the district site. Valley News reports 135-83, 2 blanks (https://vnews.com/2026/03/22/rivendell-school-budget-approved); Journal Opinion also covers it. Noted in the record, not used for adopted_date; I did not read either article beyond the search snippet.

## Discrepancies / flags (all in lines_flagged)
- Form's $8,846,318 assumes Warrant Art. 5 (use of $450,000) passes; without it VT assessments are $9,166,569.
- Form note cites revised yield $8,849 / income yield $12,154, but calculations use $9,212 / $13,098.
- Town assessments sum to $8,846,317 vs $8,846,318 (rounding).
- Form column label "Adopted or warned" does not separate adopted from warned for FY24-FY26.
- ADM bands not printed (one weighted count only) → null, flagged.
- Prior-year (FY24-26) per-town rates and CLAs not printed (form shows one equalized union rate: 1.8634 / 1.4027 / 1.6862) → null, flagged.

## needs_decision
How to represent an interstate district whose AOE form is VT-share only: records hold the VT form's education spending ($8,846,318), not the voted $16,604,487; Orford NH share ($4,298,945) is outside the VT schema. Also whether the registry should show 1 member (ud/rivendell-interstate) — documents confirm a single budget-setting district.

## Not downloaded / not read
Not downloaded (all small PDFs on the voter-information page): Budget Hearing PowerPoint, FY27 DRAFT expenditure detail, revenue, tax-rate-calculation files, warrant. The annual report already contains the same tables (FY27 "DRAFT" labels there are the district's). Older annual reports (2014-2025) are linked on the same page. Pages of the report other than 6-13 (printed), 12-13 and the minutes were not read in detail.
