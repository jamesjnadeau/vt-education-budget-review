# Handoff — 2026-10-22

Where the project stands, what changed in the session that wrote this, and what to do next.
Written for whoever picks this up cold, person or agent. The [README](README.md) describes
the system; this describes the moment.

## State in one paragraph

The pipeline is built and runs end to end: registry sync, validation, parameter tracking,
engine, site. Inputs have been arriving. The warehouse holds AOE's education spending, pupils
and tax rates for every town for FY2023–FY2026, ADM by resident district, Act 127 subgroup
counts by town, and Census land area. All twenty Act 170 groupings are transcribed. The
FY2025–FY2027 parameter files are 22/24, 23/23 and 24/25 verified against statute snapshots,
none countersigned by a person. As of this session the engine reproduces the Tax Department's
published FY2026 homestead rates for two districts in golden tests, and the same exercise
exposed one rule the engine does not model and one wrong parameter, both recorded below.

## What this session did

1. **Fetched the Tax Department's FY2026 Education Property Tax Rates table** (the CLA source
   the golden fixtures need) into `intake/tax-rates/fy2026/` with a provenance record. 260
   towns; columns CLA, SA, CLA ÷ SA, District Rate, Homestead Rate, State Rate, Nonhomestead
   Rate. Git LFS, like every intake spreadsheet.
2. **Joined that table with AOE's FY2026 EdSpend record** town by town and ran the engine's
   rate chain over all of it. Results:
   - 50 of 97 one-to-one districts: engine district rate equals the published one to four
     places. Burlington, Winooski, Slate Valley, Kingdom East, Washington Central among them.
   - 47 of 97: published rate is **lower** than the chain gives, never higher, by an amount
     that varies by district (Mt. Abraham 1.3%, South Burlington 3.9%, Colchester 5.3%,
     Addison Central 8.2%). A one-sided, district-specific reduction in the first years after
     Act 127 replaced equalized pupils is the shape of a tax-rate transition rule.
   - Marlboro, the one exactly-reproduced district over the excess spending threshold, confirms
     the § 5401(12) rule, the Act 183 base ($13,497 × 1.18 = $15,926.46) and the $8,596 yield
     together.
   - Every published billed rate equals District Rate ÷ (CLA ÷ SA **rounded to four places**).
     Dividing by the unrounded quotient reproduces only 150 of 260 rows to the last digit.
   - The table's SA is 0.7236 on every row. `fy2026.yaml` had 0.703, which is the FY2027
     figure (the FY2027 page prints SA 70.33%).
3. **Wrote three golden fixtures** in `model/goldens/`:
   - `ud-slate-valley-62-fy2026.yaml` — passes. Six towns, CLAs 0.60–1.04.
   - `town-marlboro-fy2026.yaml` — passes. Over the excess spending threshold.
   - `ud-addison-central-55-fy2026.yaml` — **known disagreement**, runs as expected-fail. Flips
     the suite red the day the engine reproduces it, which is the cue to delete the block.
4. **Extended the golden harness** (`model/src/goldens.test.ts`): fixtures may supply AOE's
   published weighted ADM instead of raw ADM; the equalized (district) rate is asserted;
   tolerances are absolute (|engine − published| ≤ tolerance); `known_disagreement` fixtures
   run their rate assertions as `it.fails` and do not count toward the publication gate.
5. **Corrected `tax.statewide_adjustment` in `model/parameters/fy2026.yaml`** to 0.7236, cited
   to the intake artifact, marked awaiting countersignature. With the old value no billed rate
   would have matched.
6. Rewrote `model/goldens/README.md`, updated the README's Current state table and Known gaps,
   and corrected the stale groupings item in `docs/fy2027-readiness.md`.

Verification run before pushing: `npm run typecheck` clean; `npm test` 692 passed, 8 expected
fail, 13 skipped, 6 failed — the 6 are pre-existing and are the xlsx readers hitting unfetched
LFS pointers in this container (`git lfs pull` fixes them, CI fetches them); `npm run validate`
0 errors; `npm run build:data`, site check and site build as in `validate.yml`.

## Open findings, in the order they block things

1. **Review the Act 127 transition (implemented 2026-10-22, uncommitted).** The rule is
   2024 Acts No. 84, Sec. 3, amended by Act 183, Secs. 16–17, not Act 127 itself; snapshots are
   in `model/statute/2026-10-22/`. The parameters `tax.transition.phase_out_share` and
   `tax.transition.rate_floor` are in fy2025–fy2027 with citations. Addison Central now passes
   (its `known_disagreement` is gone) and three more transition fixtures were added. The
   engine reproduces 86 of 97 matchable FY2026 district rates, up from 51. A person should
   decide:
   - **Rounding.** The FY2026 decrease is rounded to three places. That is what reproduces
     86 of 97 districts; the literal reading of the amended text reproduces only 57. It is a
     Tax Department convention, not statute. Confirm it with the Department before
     countersigning.
   - **Sec. 3(e).** Income percentage is not adjusted for the decrease.
   - **11 residual districts.** Listed with likely causes in
     [docs/act-127-transition.md](docs/act-127-transition.md). None has a fixture.
2. **Countersign FY2026 and set it `status: verified`.** Every FY2026 parameter is verified
   against a snapshot or published table, and the publication gate is now satisfied by two
   passing fixtures. A person reads `model/statute/2026-07-29/` against `fy2026.yaml`, then
   flips the status. The parser will accept it.
3. **The FY2026 statewide adjustment was wrong and had been countersigned.** It read 0.703, the
   FY2027 value, from a worked example on a Tax Department page. Worth a look at how the other
   "published annually" figures (yields, nonhomestead base) were sourced: the yield of $8,596
   is confirmed by the 50 reproducing districts and the nonhomestead base 1.703 matches the
   table's State Rate column, so those two are fine.
4. **Billed-rate rounding.** The Department divides by CLA ÷ SA rounded to four places. The
   engine divides unrounded. The fixtures tolerate one unit in the fourth place and say why.
   Two billed rates miss by slightly more and are left out of their fixtures with a comment:
   Williston (Champlain Valley) and Colchester.
   Decide whether the engine should round the way the Department does (then the fixtures can
   tighten to exact), or stay as the statute reads.
5. **No membership fixture.** Both passing fixtures start from AOE's published weighted ADM.
   Reproducing that number from raw ADM and the § 4010 weights needs AOE's weighted long-term
   membership report with grade-band inputs, which is not on file.
6. **FY2027 is still blocked** on the Act 73 prekindergarten contingency, the yield act figures
   and the FY2027 statewide adjustment (which the FY2027 rate page now prints as 70.33%; it
   could be entered from there with a fetched artifact, not from the current-use example).

## Housekeeping

- **CI on `main` has been red since 2026-10-15** (Validate runs 105 through 112). Two separate
  causes, neither touched by this branch. First, `tools/src/aoe/adm-subgroups/record.test.ts`
  reads the real `ADM_Sums_by_ADMTDIST_Across_Years.xlsx`, and the "fetch only the changed LFS
  artifacts" step does not pull it on a merge commit, so the reader sees an LFS pointer and
  fails. Second, once tests pass, `npm run check --workspace site` reports three type errors
  in `site/src/pages/su/[slug].astro` and `site/src/pages/town/[slug].astro` (`reporting_only`
  on `Entity`, `status` on `Cell`) that arrived with the resident-student-count pages. Both
  reproduce locally. Fix the LFS fetch script or make the real-artifact tests skip when the
  file is a pointer; fix the two page types.
- `npm run coverage` points at `tools/src/cli/coverage.ts`, which does not exist.
- Nineteen collector source URLs have been dead for eight consecutive weekly checks (GitHub
  issues 19 through 44, all open) and two liveness PRs are unmerged. Finding where each district
  moved its budget page is the work; it unblocks budget collection.
- The VLC's redrawn Act 170 committee roster is still unobtained; `intake/vlc-act170/README.md`
  has the contact and the leads.
- In this cloud container `legislature.vermont.gov`, `education.vermont.gov` and
  `tax.vermont.gov` are not reachable from `curl` or `npm run vt:fetch` (the outbound proxy
  presents its own certificate chain, which the fetcher's pinned chain rejects). The Tax
  Department table was retrieved through the session's web-fetch tool, hashed, and placed in
  intake by hand, which is what the provenance record says.

## How to check this handoff's claims

```bash
npx vitest run model/src/goldens.test.ts     # 18 passed, 8 expected fail
npm run validate                              # 0 errors; LFS-pointer warnings until git lfs pull
npm run params                                # FY2026 23/23 verified, status draft
```
