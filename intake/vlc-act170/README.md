# Vermont Learning Collaborative: Act 170 merger study committees

**This directory is deliberately empty of the document it is named for.**

The Vermont Learning Collaborative (VLC) is the educational services agency the state hired to
run the Act 170 merger study process. Act 170 printed twenty district groupings and let the
facilitators change them. On **2026-09-18** the VLC announced that they had: Vermont's **119
school districts** are now sorted into **18 committees**, after **13 districts** asked to be
moved and were.

That announcement is the authority for `reassignment` in
[`registry/groupings.yaml`](../../registry/groupings.yaml), and we do not have it.

## What belongs here

| | |
|---|---|
| Artifact | The VLC press release of 2026-09-18 announcing the new committees, **and the committee-by-committee membership list it refers to** |
| Publisher | Vermont Learning Collaborative, 54 Main St., Suite 200, Windsor VT 05089 — 802-428-6789 |
| Lead facilitator | Dave Younce |
| Status when announced | A starting point, not a decision. Comment closed 2026-09-23; the VLC aimed to settle the groups 2026-09-25. Get the settled list, not the draft. |
| Statutory deadlines it sits inside | Committees appoint members by 2026-09-15, first meet by 2026-10-15, report by September 2027, voters decide Town Meeting Day 2028 |

## Why it is not here

No state page carries the rosters. `education.vermont.gov`'s education transformation page
still describes the act's twenty groupings and links no committee list. The VLC's own site was
not reachable when this was written. The release was distributed to press rather than posted
somewhere fetchable, and the reporting on it does not print the rosters.

**Ask the VLC for the list directly.** When it arrives, drop it in beside this file exactly as
released, write a `provenance.yaml` recording the source URL or how it was obtained, the
retrieval date and method, the SHA-256 and who fetched it — the pattern to copy is
[`intake/aoe-adm/fy2024/provenance.yaml`](../aoe-adm/fy2024/provenance.yaml) — then transcribe
the committees into `registry/groupings.yaml` and set `reassignment.roster_published: true`.

## Leads, as of 2026-09-27

- **The list exists and went to reporters.** VTDigger's 2026-09-18 story says four districts
  "appear to be in Franklin County, based on the list of new committees" — so the reporter had
  the list. It just was not printed. Asking VTDigger (Charlotte Oliver) is a second route.
- **The Caledonian Record may have printed it.** Its story "Vermont Learning Collaborative
  Announces Preliminary Merger Study Groupings" is behind a paywall (HTTP 402 to an automated
  fetch). A person with a subscription should read it:
  <https://www.caledonianrecord.com/news/local/vermont-learning-collaborative-announces-preliminary-merger-study-groupings/article_ce4d86d3-12ae-56c9-96cd-78b77b7d8b73.html>
- **It was meant to be final by 2026-09-25.** No report yet says it was. Committees must meet by
  2026-10-15, so first-meeting agendas posted by supervisory unions will start naming who is in
  each room. Those are primary sources for single committees even before the full list lands.

## What we have instead, and what it is worth

One news report:

> VTDigger, "School districts assigned to new merger discussion groups", 2026-09-18.
> <https://vtdigger.org/2026/09/18/school-districts-assigned-to-new-merger-discussion-groups/>

It is good for the shape of the change — the counts, the dates, the fact that the groups moved
at all — and those are recorded from it. It is not a roster. It names **one** of the thirteen
moves: Harwood Union UUSD out of the Barre/Montpelier group, in with Mount Mansfield UUSD.
Younce declined to say which thirteen districts asked to move.

Two law firm newsletters from Downs Rachlin Martin add a little:

> "Vermont School Consolidation: Progress Update 09.14.2026" and "… 09.21.2026".
> <https://www.drm.com/articles/vermont-school-consolidation-progress-update-09-14-2026/>
> <https://www.drm.com/articles/vermont-school-consolidation-progress-update-09-21-2026/>

The first, written before the announcement, names what three districts asked for: Harwood (to
study with Champlain Valley and Mount Mansfield — exactly act group 13), Windham (to join "the
group containing Londonderry") and Readsboro (a group that keeps high-school choice, no
destination named). The second says all thirteen requests were granted **and that the
facilitators made further moves of their own** to keep groups near 2,000 students. That is how
Windham got into `known_changes`, and why `additional_adjustments` is true: thirteen is a floor
on the number of moves, not the number.

## Why the missing twelve matter more than they look

A grouping page answers "which districts am I about to spend a year studying a merger with?" We
can now say with certainty that the answer we hold is wrong for at least one district, and we
cannot say which of the other nineteen groups changed. That is a materially different state from
before the announcement, and it is worse than it looks: a page that quietly kept showing the
act's group would be confidently wrong for twelve districts we cannot name.

So `reassignment.roster_published` stays **false**, every grouping page carries the warning, and
`known_changes` holds exactly the moves that have a source — two, as of 2026-09-27. Landing the VLC's list is what
lifts that — not deleting the warning.
