# Handoff — 2026-11-27

Where the project stands and what to do next. Written for whoever picks this up cold, person
or agent. The [README](README.md) describes the system; this describes the moment. Earlier
versions (2026-10-22, 2026-11-22) are in git history.

## State in one paragraph

The pipeline is built and runs end to end: registry sync, validation, parameter tracking,
engine, site. The warehouse holds AOE's education spending, pupils and tax rates for every
town for FY2023–FY2026, ADM by resident district, Act 127 subgroup counts by town, and Census
land area. All twenty Act 170 groupings are transcribed. FY2026 parameters are 25/25 verified
and countersigned (`status: verified`, 2026-11-25). FY2027 is 27/27 verified, `status: draft`.
The engine models the Act 127 tax-rate transition (2024 Acts No. 84, Sec. 3, as amended by
Act 183) and reproduces the Tax Department's published FY2026 district rate for 86 of the 97
districts that match one-to-one. Before the transition was modelled, it reproduced 51. Six
golden fixtures pass, and none is marked as a known disagreement.

## Done since the 2026-10-22 handoff

- **Act 127 transition committed** (`88c0748`). Parameters `tax.transition.phase_out_share`
  (0.8) and `tax.transition.rate_floor` (1.00) are in fy2025–fy2027 with citations, and the
  statute snapshots are in `model/statute/2026-10-22/`. Addison Central's `known_disagreement`
  block is gone. Champlain Valley, Mt. Abraham and Colchester fixtures were added. See
  [docs/act-127-transition.md](docs/act-127-transition.md).
- **Three-place rounding of the FY2026 decrease confirmed** (2026-11-27). The Tax Department
  rounds FY2025 decrease × 0.8 ÷ SA to three places. That is the reading that reproduces 86
  of 97. The literal reading of the amended text reproduces 57. It is a Department convention,
  not statute text, so record the source of the confirmation (letter, email or contact) in
  `docs/act-127-transition.md`.
- **FY2026 countersigned** (`c779964`, 2026-11-25). The corrected statewide adjustment of
  0.7236 is in, cited to `intake/tax-rates/fy2026/`.
- **CI on `main` is green.** The site type errors were fixed in `b270df4`, and the last two
  Validate runs on `main` (2026-11-26, 2026-11-27) passed.
- **Grouping combined totals** use AOE's stated education spending for members without a
  usable budget (`5727484`). Group 11 is still the exception (below).
- Resident journey pages (town, district, union, grouping), the grouping combiner page, and
  rate notes and source lines on the pages all landed on 2026-11-21 through 2026-11-25.

## Open findings, in the order they block things

1. **Countersign FY2027.** `fy2027.yaml` is 27/27 verified and still `status: draft`. The
   Act 73 contingency (did not fire; pre-repeal prekindergarten weight governs) and the
   yield-act figures ($9,401 / $12,960) were already settled; the statewide adjustment,
   0.7033, was entered 2026-11-27 from the Department's FY2027 rate table, now on file at
   `intake/tax-rates/fy2027/`. A person reads the sources against the file and flips the
   status. Next after that: import the FY2027 table into the warehouse
   (`tax-rates:import` is hard-wired to FY2026) and add FY2027 golden fixtures.
2. **Billed-rate rounding.** The Department divides by CLA ÷ SA rounded to four places, and
   the engine divides by the unrounded quotient. The fixtures allow one unit of error in the
   fourth place and say why. Two billed rates miss by slightly more and are left out of
   their fixtures with a comment: Williston (Champlain Valley) and Colchester. Now that the
   Department's three-place convention for the transition is confirmed, decide whether the
   engine should also follow its four-place convention here (then the fixtures can tighten to
   exact) or stay with the statute as written.
3. **Sec. 3(e) income percentage.** `incomeBasedRate` does not yet apply the transition
   decrease to households claiming the income adjustment.
4. **11 residual districts.** Listed with likely causes in
   [docs/act-127-transition.md](docs/act-127-transition.md): Norwich and Hartford (likely
   excluded spending), four possible Sec. 3(g) successors, Canaan, and four modified or
   high-school unions published *above* the chain. None has a fixture, and each needs a reason
   read from a document before it gets one.
5. **No membership fixture.** Every passing fixture starts from AOE's published weighted ADM.
   Reproducing that number from raw ADM and the § 4010 weights needs AOE's weighted long-term
   membership report with grade-band inputs, which is not on file.
6. **Group 11 still has no combined total.** `/groupings/11/` is the only grouping page that
   still shows "Combined total not computed". Act 170 lists "Essex North Supervisory Union"
   (`su/essex-north`) as a member. It is a supervisory union, not a district, so AOE states
   no spending for it. Its districts, Canaan and Northeast Kingdom Choice, are already
   members, so filling the gap from them would double-count. Decide whether to drop that
   member from the computation, treat it as a non-district, or leave it as a labelled gap.

## Housekeeping

- **Real-artifact tests skip on an unfetched LFS pointer** (`tools/src/lfs.ts`, `isFetched`).
  A fresh clone's `npm test` is clean without `git lfs pull`. CI still runs them: its LFS
  fetch fails the run if any intake spreadsheet is still a pointer.
- `npm run coverage` points at `tools/src/cli/coverage.ts`, which does not exist. Fix the
  script or remove it.
- **Dead collector source URLs.** Issue #71 is the single tracker; the twelve earlier
  weekly issues were closed into it on 2026-11-27. The real work is finding where each
  district moved its budget page, which unblocks budget collection. The weekly workflow
  comments on the oldest open `dead-link` issue instead of opening a new one, and uses one
  fixed PR branch (`liveness/weekly`).
- **The `Test` org ID in AOE's `independentSchools` and `organizations` endpoints is the
  project owner's own test record**, confirmed 2026-11-27. The sync's placeholder warning
  about it is expected and correct (`registry/placeholder.ts` skips it); it is not an
  upstream error and needs no report to AOE.
- The VLC's redrawn Act 170 committee roster is still unobtained.
  `intake/vlc-act170/README.md` has the contact and the leads.
- **Fetching State sites from the container.** On 2026-11-27, `curl` reached
  `tax.vermont.gov` when given a browser User-Agent; the default one gets a 403. Earlier
  sessions saw the outbound proxy's certificate chain rejected by `npm run vt:fetch`'s pinned
  chain, and that is untested since. `git lfs` is not installed in the image; a user-level
  binary in `~/.local/bin` works, and without it a new intake spreadsheet would be committed
  as a plain blob.

## How to check this handoff's claims

Results as of 2026-11-27 on `fix/typecheck-test-files`, without `git lfs pull`:

```bash
npm run typecheck                             # clean
npx vitest run model/src/goldens.test.ts     # 42 passed, 0 expected fail
npm test                                      # 1278 passed, 33 skipped, 0 failed (before build:data)
npm run validate                              # 0 errors, 22 warnings (LFS pointers)
npm run params                                # FY2026 25/25 verified; FY2027 27/27, draft
gh run list --branch main --workflow validate.yml -L 3   # latest: success
```
