# Vermont Learning Collaborative: Act 170 merger study committees

The Vermont Learning Collaborative (VLC) is the educational services agency the state hired to
run the Act 170 merger study process. Act 170 printed twenty district groupings and let the
facilitators change them. On **2026-09-18** the VLC did: Vermont's **119 school districts** are
now sorted into **18 committees**, after **13 districts** asked to be moved.

## What is here

| | |
|---|---|
| File | [`New-Groupings-as-of-9-18-26.pdf`](New-Groupings-as-of-9-18-26.pdf) — see [`provenance.yaml`](provenance.yaml) |
| What it is | The VLC press release of 2026-09-18, "Vermont Learning Collaborative Shares Preliminary Act 170 Merger Committee Groupings" |
| Where it came from | Hosted by The Chester Telegraph, not by the VLC. The copy carries VLC letterhead on every page. |
| What it holds | All 18 committees with their region, member districts, each district's latest two-year average ADM from AOE, and a committee total. Career and technical centers are listed on four committees without an ADM. Plus the milestone dates. |
| Publisher | Vermont Learning Collaborative, 54 Main St., Suite 200, Windsor VT 05089 — 802-428-6789. Lead facilitator Dave Younce. |

It is transcribed into `reassignment.committees` in
[`registry/groupings.yaml`](../../registry/groupings.yaml), which is why
`reassignment.roster_published` is now **true**.

## What the list says, in short

- The facilitators kept the act's group numbers. Groups **6** and **16** were dissolved — board
  requests left them below Act 170's ~2,000-student floor — and their districts were reassigned.
- 22 registry records changed group (counting West River's #72A/#72B as two). The site derives
  the moves by comparing the committees with the act; they are not written down separately.
- Essex North Supervisory Union, which the act lists in group 11, is not on the list. Its
  operating districts (Canaan, NEK Choice) are in Group Eleven, so this reads as the release
  naming districts rather than the SU — not a move.

## What to be careful of

- **It is the preliminary list.** Boards could comment 2026-09-18 to 2026-09-23 and the VLC aimed
  to finalize on 2026-09-25, saying updates would be shared "through the same channels". We have
  not seen a final list. If one turns up, land it here beside this one (with `supersedes` in its
  provenance entry), update `committees`, and set `reassignment.status: final`.
- **Not yet checked by a person.** The rosters were transcribed by script from the PDF's text
  layer. Every committee's ADM figures add up to its printed total except Group One: it prints
  3,248, but its three districts (1,669 + 889 + 1,190) add to 3,748. The printed figure is kept
  and flagged. Each committee stays `verified: false` until someone reads it off the PDF.
- **Names do not always match the act's.** The mapping to registry slugs reuses the act's
  verified matches where the names agree; the rest are mapped by hand (for example "Waits River
  Valley Union School District #36", "Lamoille North MUSD and Lamoille USD"). Each roster line
  keeps the name exactly as written beside its slug.
