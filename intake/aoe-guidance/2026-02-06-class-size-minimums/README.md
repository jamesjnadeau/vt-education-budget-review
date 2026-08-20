# AOE memo: working definitions to meet the Act 73 class size minimums

The Secretary's memo of **February 6, 2026** to superintendents, business managers and
school board members, giving SU/SDs working definitions for the class size minimums that
16 V.S.A. § 165(a)(9) — as amended by Act 73 of 2025, Sec. 6 — imposes beginning with the
**2026–2027 school year**.

Read alongside [docs/act-73-class-size-minimums.md](../../../docs/act-73-class-size-minimums.md),
which maps each definition onto the statutory sentence it is interpreting and records where
the two do not line up.

## What is here

| File | What it is |
|---|---|
| `edu-sbe-class-size-min-working-definitions-memo.pdf` | The memo exactly as released. 6 pages, 251,073 bytes, `sha256:b10058ecaa251188a5fb3395e29b733fd305998ae5fb29da6df5fa04730cca73`. |
| `edu-sbe-class-size-min-working-definitions-memo.txt` | Text extraction, so the memo is greppable and diffable without an LFS fetch. `sha256:e7acb6347e1bc088041f42f852613dc63f85e4f70cdc243e5cdc7ebde1f08ab9`. Produced by `pdftotext -layout` (poppler 25.03.0). Not authority — the PDF is. |

The PDF's own metadata, which is the best internal evidence of its origin:

| | |
|---|---|
| Title | Memo to Business Managers and SB Members from Secretary Saunders |
| Subject | Memo: Working Definitions to Meet Class Size Minimums |
| Author | AOE |
| Created | 2026-02-06 10:11:29 EST |
| Modified | 2026-05-27 14:57:33 EDT |

The modification date is three and a half months after the memo's own date. Whether AOE
revised the text or only re-saved the file is not knowable from the bytes. If a copy dated
2026-02-06 in both fields ever turns up, it is a different artifact and belongs here beside
this one with its own hash, not in place of it.

## Where it came from

`provenance.yaml` records it: downloaded by hand on **2026-08-20** from AOE's published short
link, <https://education.vermont.gov/documents/edu-sbe-class-size-min-working-definitions-memo>,
and confirmed by the person who downloaded it.

By hand because it had to be. `npm run vt:fetch` is refused with **HTTP 403** — the CloudFront
block AGENT.md documents for `education.vermont.gov`, which is not the incomplete TLS chain that
affects `legislature.vermont.gov` and has no clean programmatic workaround. Do not try to defeat
it; download in a browser and record the retrieval, which is what happened here.

The recorded URL is the `/documents/` short link AOE publishes, not the
`/sites/aoe/files/documents/` storage path it currently resolves to. The published link is the
one a reader can be sent to and the one AOE maintains.

`npm run validate` re-verifies the SHA-256 on every pull request. A mismatch means the artifact
was edited, which is never permitted — work out what changed the file rather than updating the
hash to match.

## Missing: the excluded-courses attachment

The flexible pathways answer on page 5 refers to "a list of the 'excluded courses' in the
attached file." **No attachment came with this PDF.** That list is the operative document for
deciding which courses drop out of the averages, so it is worth chasing separately; it belongs
in this directory beside the memo when it lands.
