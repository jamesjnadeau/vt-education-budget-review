> **Import findings** — notes written by the agent that captured this SU's FY2027 documents on 2026-11-28.
> They are self-reported working notes, only partly spot-checked, not a warehouse record. Where they disagree with
> a record or a document under `intake/`, the document wins. "Staged" below means the file is now under `intake/`
> (a few over-30 MB files were added later in the same PR); "staged" collector configs are in PR #84.
> Open decisions are collected under *needs_decision* where the agent listed any.

# su/kingdom-east — Kingdom East Supervisory District (SU067) / Kingdom East USD #64 (U064)

Retrieved 2026-11-28. One budget-setting district (Kingdom East Unified Union SD, 8 towns: Burke, Concord, Lunenburg, Lyndon, Newark, Sheffield, Sutton, Wheelock; all schools PreK-8, grades 9-12 are school choice/tuition). Warehouse records written for the SU entity.

## Site
- https://www.kingdomeast.org/ (registry URL is current; no mismatch, so no collectors/config.yaml staged). Budget pages: /fy27-budget (archive of FY27 season), /fy28-budget (FY28 in development, no document yet), /school-board (annual reports 2025, 2026), /kingdom-east-fy27-budget-results (March results).

## Documents (all FY2027, all staged under intake/su-kingdom-east/fy2027/)
| Doc | Direct URL | Size | Staged |
|---|---|---|---|
| 2026 Annual Report (44 pp.; AOE form is an image on PDF p. 22) | https://irp.cdn-website.com/6417ac47/files/uploaded/2026+KESD+Annual+Report-Final.pdf | 68,244,372 B | yes |
| FY27 DRAFT budget 1/6/26 line items (4 pp.) | .../FY27+DRAFT+Budget+1.6.26+with+Tiered+Reductions+Board+Approved.pdf | 141,075 B | yes |
| Vote #3 taxpayer budget summary (1 p.) | Drive id 1x0uHmvP0860x30wO4CyMnFrcuUy7foYM | 78,495 B | yes |
| Warning, revote informational meeting (scanned, 1 p.) | Drive id 1TY4vzf17WalznCYKstV6yjWJbJ07NaT5 | 77,026 B | yes |
Not downloaded (all on /fy27-budget): FY27 DRAFT total/revenue PDFs and per-department drafts (Drive/CDN), "Table View of Pie Graph" PDF, recount warning (FY+27+Budget+Recount.pdf), Google Slides narrative/informational presentations, tax comparison vote #1 vs #3 (Drive), budget schedule (Sheets), 2025-26 enrollment projection PDFs. Slides/Sheets are not true originals; the others were not needed. The "FY27 Revenue 1st DRAFT" PDF would give a revenue detail for the first draft; not read. The 2025 annual report (FY26) is linked from /school-board; not staged.

## Three budget votes for FY27 (key complication)
1. Mar 3, 2026, $53,401,362 (annual report version): FAILED 632-730 (district: kingdomeast.org/kingdom-east-fy27-budget-results, Article 4).
2. Apr 28, 2026, $53,251,362: FAILED 460-614 (Caledonian Record, secondary; not on a district page I read).
3. Jun 11, 2026, $53,251,362 with extra $250K Tax Stabilization (total $850K): PASSED 969-944; recount Jun 23 confirmed (district page /fy27-budget).
Records: fy2027-warned = vote 1 (defeated) from the annual report; fy2027-approved = vote 3 (passed), education spending null.

## Headline FY27 figures (vote 1, annual report; AOE form PDF p. 22, stamped PRELIMINARY, image read at 300 dpi)
Budget $53,401,362; revenues $6,124,879; education spending $47,276,483; LTWADM 3,179.88; per pupil $14,867.38; equalized homestead rate $1.6139; yield $9,212; threshold $16,470. Prior columns: FY26 $50,349,157 / $5,524,879 / $44,824,278 / 3,255.81 / $13,767.47; FY25 $47,597,821 / $5,180,000 / $42,417,821 / 3,293.79 / $12,878.12; FY24 $41,083,575 / $5,588,910 / $35,494,665 / 1,820.73 equalized pupils / $19,494.74. All columns re-added in code (budget-revenue=spending; spending/pupils=per-pupil).
Vote 3 (passed): $53,251,362; per-pupil $14,742 (warning). Education spending dollars not printed anywhere I read.

## Discrepancies (recorded, not reconciled)
- FAQ on /fy27-budget: per-student spending "increased by $945 to $14,742"; $14,742-$13,767 = $975 (warning's 7.08% matches $975).
- Chart 7 prints excess-over-threshold $16,470 (= threshold); form row 24 prints "-".
- Annual report p. 2 headed "2025 ANNUAL REPORT"; right edge of the form image is cropped by a black bar; FY27 estimates assume a one-time $75M General Fund transfer.
- Warning PDF titled "REVISED BUDGET #2" though it is the third vote; internal PDF title "6.11.26 KESD budget warning".
- FY24 pupils are equalized pupils (1,820.73), not comparable with LTWADM.

## Filenames
Annual report and line-item PDF: server sent no Content-Disposition, so filenames are last URL segment with "+" read as space. Drive files use the Content-Disposition filename.

## needs_decision
- Whether the warned (defeated) FY27 record plus an approved record with null education spending is the preferred treatment of the three-vote history.
- Education spending/revenues for the passed budget: ask the district for the final AOE three-prior-years form (or vote #3 revenue figure) and per-town rates/CLAs.

## Not read
Per-department draft PDFs, slide decks, the recount warning, enrollment reports, text of the annual report beyond Charts 1, 6-10 and front matter (audit/treasurer sections skimmed only by text search).

## Large files (over 30 MB)

These were first held back from the import for size and were then added to the PR. They are in `intake/` as received. Notes below are the provenance notes for each file, with the records that cite it.

### 2026 KESD Annual Report-Final.pdf

- **Path:** `intake/su-kingdom-east/fy2027/2026 KESD Annual Report-Final.pdf`
- **Size:** 68,244,372 bytes (68 MB)
- **sha256:** `5094effa056411a99454745195d554bccb9935b63aad671bec3c6de0682ad36e`
- **Source:** https://irp.cdn-website.com/6417ac47/files/uploaded/2026+KESD+Annual+Report-Final.pdf
- **Records citing it:** `warehouse/su-kingdom-east/fy2024-approved.yaml`, `warehouse/su-kingdom-east/fy2025-approved.yaml`, `warehouse/su-kingdom-east/fy2026-approved.yaml`, `warehouse/su-kingdom-east/fy2027-warned.yaml`
- **Provenance note:** Annual report issued ahead of the March 3, 2026 FY2027 budget vote (44 pp.). Chart 1 (PDF p. 10) and Chart 7 (p. 19) give the FY27 proposed budget $53,401,362 and estimated rates; Chart 8 (p. 20) gives estimated per-town tax rates and CLAs for the eight member towns; Chart 10 (PDF p. 22, printed p. 20) is the AOE 'Three Prior Years Comparisons' form (FY2024-FY2027), stamped PRELIMINARY, and is an image with no text layer: figures were read from 300-dpi renders and re-added. The file is 68 MB. The server sent no Content-Disposition, so the filename is the last URL path segment with '+' read as a space. The district's news post dated 2026-02-18 announces the report; the PDF's internal creation date is 2026-02-09 (producer 'OutlinePDF-Advance'). Page 2 of the report is headed '2025 ANNUAL REPORT'. The PDF's last-modified header is 2026-02-11. No publication date is stated by the district on the document itself, so published_date is null. This is the document for the FIRST budget vote (defeated 632-730); the budget that finally passed on June 11, 2026 is the later $53,251,362 version in the documents below.
