# Vermont Learning Collaborative: Act 170 merger study committees

The Vermont Learning Collaborative (VLC) is the educational services agency the state hired to
run the Act 170 merger study process. Act 170 printed twenty district groupings and let the
facilitators change them. On **2026-09-18** the VLC did: Vermont's **119 school districts** are
now sorted into **18 committees**, after **13 districts** asked to be moved.

## What is here

| File | What it is |
|---|---|
| [`New-Groupings-as-of-9-18-26.pdf`](New-Groupings-as-of-9-18-26.pdf) | The VLC press release of 2026-09-18, "Vermont Learning Collaborative Shares Preliminary Act 170 Merger Committee Groupings". The first list. Hosted by The Chester Telegraph, not by the VLC; it carries VLC letterhead on every page. |
| [`VTLC-Act-170-Sept-25-Press-Release.pdf`](VTLC-Act-170-Sept-25-Press-Release.pdf) | The VLC press release of 2026-09-25 declaring the groupings final, with the full list. Moves Ludlow-Mount Holly from Group Seven to Group Three and fixes Group One's printed total. |
| [`11.12.26-Updated-Merger-Committee-Groups.pdf`](11.12.26-Updated-Merger-Committee-Groups.pdf) | The VLC's updated list of 2026-11-12. Moves Sandgate from Group Four to Group Three and Echo Valley from Group Nine to Group Twenty. **This is the edition transcribed.** |
| [`Nov2026-Merger-Committee-Groupings-Map.pdf`](Nov2026-Merger-Committee-Groupings-Map.pdf) | A statewide map of the updated groupings, dated 2026-11-13 (VCGI ArcGIS). Image only; kept for reference. |

The last three come from the VLC's own resources page, <https://vtlc.org/resources>. See
[`provenance.yaml`](provenance.yaml) for URLs and checksums.

Each list gives all 18 committees with their region, member districts, each district's latest
two-year average ADM from AOE, and a committee total. Career and technical centers are listed on
four committees without an ADM. Publisher: Vermont Learning Collaborative, 54 Main St., Suite 200,
Windsor VT 05089 — 802-428-6789. Lead facilitator Dave Younce.

The 2026-11-12 list is transcribed into `reassignment.committees` in
[`registry/groupings.yaml`](../../registry/groupings.yaml), with `reassignment.status: final`,
`finalized_date: 2026-09-25` and `roster_as_of: 2026-11-12`. `as_of` stays 2026-09-18, the date
of the regrouping itself.

## What the list says, in short

- The facilitators kept the act's group numbers. Groups **6** and **16** were dissolved — board
  requests left them below Act 170's ~2,000-student floor — and their districts were reassigned.
- On the 2026-11-12 list, 24 registry records are in a different group than the act put them in (counting West River's #72A/#72B as two). The site derives
  the moves by comparing the committees with the act; they are not written down separately.
- Essex North Supervisory Union, which the act lists in group 11, is not on the list. Its
  operating districts (Canaan, NEK Choice) are in Group Eleven, so this reads as the release
  naming districts rather than the SU — not a move.

## What to be careful of

- **The list was final on 2026-09-25 but has changed since.** The 2026-11-12 update moved two
  more districts. If another update turns up, land it here beside these (with `supersedes` in its
  provenance entry), update `committees`, and move `roster_as_of`.
- **Checked 2026-11-22.** The rosters were transcribed by script from the PDFs' text layers.
  James Nadeau read the lists line by line, and each committee is `verified: true`. As a second
  check, a script compared every roster line, ADM figure and committee total against the
  2026-11-12 list's text; all 121 lines matched once Group Fifteen's "&" spelling was corrected. (The 2026-09-18 list printed Group One
  as 3,248; its districts add to 3,748, and the later lists print 3,748.)
- **The map shows "Unassigned" areas** around Vershire / West Fairlee / Fairlee and Norwich. These
  are likely the interstate districts, which are not on any list. Not confirmed.
- **Names do not always match the act's.** The mapping to registry slugs reuses the act's
  verified matches where the names agree; the rest are mapped by hand (for example "Waits River
  Valley Union School District #36", "Lamoille North MUSD & Lamoille USD"). Each roster line
  keeps the name exactly as written beside its slug.
