# Combiner "Use estimate" boxes — design

Date: 2026-11-22. Status: approved by James Nadeau in conversation (small change; short design).

## Intent

The combiner asks the visitor for three pooled counts the State does not publish per district: students in state-placed care, students from lower-income homes, and English learners. Today they must type all three or leave the pool blocked. The what-if tool already offers a "use estimate" checkbox next to figures it can suggest. The combiner should do the same where an honest estimate exists, labeled as an estimate.

## Goals

- "Students from lower-income homes" and "English learners" each get a "Use estimate" checkbox.
- The estimate is the sum, over the towns of the picked districts, of AOE's town-of-residence counts for school year 2024–25 (fiscal year 2026, final): free-or-reduced-lunch (`nslelg`) for the poverty box, English-learner (`ell`) for the EL box.
- The visitor can always see that the number is an estimate and how it was made.

## Non-goals / anti-goals

- State-placed students: no town-level source exists. The box stays blank with no checkbox.
- Never present an estimate as a published figure. Never silently sum a partial set.
- No upper-bound solving for complement-suppressed cells.
- Not SY26 (preliminary) and not SY24 (ELL/FRL not imported).

## Constraints

- AOE suppresses cells under 11 students. Published cells are numbers, bounded suppressed cells (0–10 at the reporting floor), or complement-suppressed cells with no bounds (`PublishedCell` in `tools/src/aoe/adm-subgroups/publish.ts`).
- FRL is not the 185%-of-poverty count the law uses. Counts are students resident in the towns, not necessarily enrolled in the district (close for union/unified districts, rough where towns tuition out).
- Pooled-count logic lives in `model/src/combine.ts`; this change must not alter how published district counts are summed.

## Approaches

1. **Town cells in the generated data; browser sums the picked towns** (chosen). Same shape as the density prefill. Works for partial-town picks.
2. Precompute a per-district estimate in the build. Rejected: wrong when a district is only partly picked or a town is shared.
3. Leave both boxes manual. Rejected by James: wants parity with the what-if tool.

## Decisions

- The filled value is the sum of published cells: a **lower limit**, not a midpoint.
- Note under each box: "at least N" and, when every withheld cell is bounded, "up to M" (0–10 per bounded withheld cell), plus how many towns were withheld. With any complement-suppressed or missing town: "at least N", no upper bound, said plainly. Towns with no record are named.
- Typing in the box unticks the checkbox. Result assumptions say "estimate from AOE town-level counts" instead of "entered on this page".
- The share link carries the estimate flags (`poverty_est=1`, `el_est=1`); an opened link re-ticks and refills from current data. Unknown params stay ignored.
- Page copy that says the page "will not fill it in for you" is updated to say which two figures it can estimate and that state-placed is still yours to enter.

## Left to the builder

Exact wording of notes within the rules above; CSS for the checkbox rows (copy `use-suggestion` styling); analytics event naming (follow `estimate_suggestion_toggled`).
