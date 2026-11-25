# Reader feedback, one persona at a time

These are reviews of the public site written as one specific person, in their own
words, walking the site the way that person would. They exist because the site's
own copy is written by people who already know how Vermont funds schools, and
that is the one thing a resident does not have.

## What makes one of these useful

1. **One person, one town, one errand.** Not "users" — *a 10-year-old in Milton
   trying to find out what his school costs*. The errand is what makes the
   findings testable: either the site answered it or it did not.
2. **The person is never the problem.** Every place they got stuck is a copy,
   structure, or data defect. If a sentence has to be read twice, that is a
   finding, not a failure of the reader.
3. **Quote the site, not the impression.** Every complaint in these documents
   points at words that are actually on the page, or at a number that is
   actually shown. "Confusing" is not a finding; "the figure `1.2462` appears
   with no unit anywhere on the page" is.
4. **Two layers, kept apart.** The persona's report comes first and is written
   as they would write it. Below a rule comes the builder's section: the same
   complaints with evidence, severity, and `file:line` where the cause is known.
   Mixing the two makes both weaker — the persona stops sounding like a person,
   and the defect list stops being checkable.
5. **Say what was not checked.** Device, browser, and anything behind a login
   are stated as unverified rather than assumed. A review that quietly guesses
   is worse than a review with a shorter scope.
6. **End with a fix order, not a wish list.** Numbered, smallest-first where the
   smallest fix removes the largest confusion, and separable from taste.

## Status labels used

- **Defect** — verifiably wrong, or contradicts the site's own stated rules.
  Carries `file:line` where the cause is in this repo.
- **Gap** — nothing is wrong, but the errand cannot be finished.
- **Taste** — a judgement call. Marked as such and never mixed into the first two.

## Files

| File | Persona | Errand |
|---|---|---|
| `2026-11-24-milton-fifth-grader.md` | 10-year-old, Milton | "What does my school cost?" |
| `2026-11-24-milton-adult-fifth-grade-reading-level.md` | 41-year-old, reads at a 5th-grade level, Milton | "Is my bill going up and is my school closing?" |
| `2026-11-24-norwich-college-professor.md` | college professor, Upper Valley, Norwich | "Is this defensible, and can I check your work?" |
| `2026-11-24-barre-plumber.md` | 50, plumber and landlord, Barre City | "Why does my brother in Barre Town pay less for the same district?" |
| `2026-11-24-brattleboro-retired-teacher.md` | 67, retired teacher from out of state, Brattleboro | "What am I actually paying, and where is the budget?" |
| `2026-11-24-hinesburg-parent-of-three.md` | 39, three kids at HCS and CVU, Hinesburg | "What do my kids' schools cost, and are we being merged?" |
| `persona-review-template.md` | — | Copy this to add one |

## Adding one

Copy `persona-review-template.md`, fill it in from an actual walk of the live
site, and add a row above. Keep the section order and headings identical so the
documents can be read side by side and compared; the value across a set comes
from the structure being boring and fixed.

Personas worth adding, in rough order of how many Vermonters they represent:
a town-meeting voter who has never read a school budget; a school board member;
a district business manager; a reporter on deadline; a parent whose first
language is not English; someone on a phone with a slow connection; a state
legislator's staffer.
