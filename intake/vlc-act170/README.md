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

## What we have instead, and what it is worth

One news report:

> VTDigger, "School districts assigned to new merger discussion groups", 2026-09-18.
> <https://vtdigger.org/2026/09/18/school-districts-assigned-to-new-merger-discussion-groups/>

It is good for the shape of the change — the counts, the dates, the fact that the groups moved
at all — and those are recorded from it. It is not a roster. It names **one** of the thirteen
moves: Harwood Union UUSD out of the Barre/Montpelier group, in with Mount Mansfield UUSD.
Younce declined to say which thirteen districts asked to move.

## Why the missing twelve matter more than they look

A grouping page answers "which districts am I about to spend a year studying a merger with?" We
can now say with certainty that the answer we hold is wrong for at least one district, and we
cannot say which of the other nineteen groups changed. That is a materially different state from
before the announcement, and it is worse than it looks: a page that quietly kept showing the
act's group would be confidently wrong for twelve districts we cannot name.

So `reassignment.roster_published` stays **false**, every grouping page carries the warning, and
`known_changes` holds exactly the one move that has a source. Landing the VLC's list is what
lifts that — not deleting the warning.
