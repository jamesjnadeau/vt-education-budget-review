# Framework for Considering Small/Sparse Schools That Operate by Necessity

**This directory is deliberately empty of the artifact it is named for.**

## What belongs here

The State Board of Education's special committee reported to the Board on 2025-12-17 under the
charge in Act 73 of 2025, Sec. 8. That presentation is the primary source for every
`framework.*` parameter in `model/parameters/fy2030-small-sparse.yaml` — the 45- and 60-minute
travel time thresholds, the 10-to-15-mile range, and the five proposed necessity criteria.

| | |
|---|---|
| Landing page | https://education.vermont.gov/document/sbe-agenda-item-j-2-12-17-2025 |
| Artifact | https://education.vermont.gov/sites/aoe/files/documents/SBE%20Small%20Sparse%20presentation.pdf |
| Charge | 2025 Acts and Resolves No. 73, Sec. 8 |
| Adoption status | Proposed, not adopted. Presented under the heading "Possible criteria" |

## Why it is not here yet

`education.vermont.gov` returns HTTP 403 to every non-browser client, for the document page and
the direct file URL alike — see AGENT.md. This is a CloudFront refusal after a successful TLS
handshake, not the incomplete certificate chain that affects `legislature.vermont.gov`, and
there is no clean programmatic workaround. Attempting to defeat the block would be both rude
and fragile.

**Download it by hand from a browser**, drop it in beside this file exactly as released, and
write a `provenance.yaml` recording the source URL, the retrieval date and method, the SHA-256,
and who fetched it. The pattern to copy is `intake/aoe-adm/fy2024/provenance.yaml`.

## Why this matters more than it looks

The quoted text in the parameter file came from a copy supplied in conversation. It is very
probably accurate. It is not a hashed intake artifact, and under README rule 2 that distinction
is the whole point: an artifact whose bytes nobody can verify cannot support a citation, however
right the words in it are.

So every `framework.*` parameter stays `verified: false` until this file exists, and the engine
declines to compute from any of them. That refusal is correct. Landing the PDF and its hash is
what lifts it — not editing the flag.

Once it is here, `npm run validate` re-verifies the hash on every pull request. A mismatch is
always an error and never a prompt to update the hash.
