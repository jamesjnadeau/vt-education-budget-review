# ADM-24 intake notes

Holds retrieval facts for this artifact until the ADM import lands and replaces
this file with a schema-validated `provenance.yaml`. It is Markdown rather than
`provenance.yaml` deliberately: a `provenance.yaml` here fails `npm run validate`
today, for a reason that is a design finding rather than a mistake. See
`docs/superpowers/specs/2026-07-29-aoe-adm-import-design.md`, "Validation
integration".

| | |
|---|---|
| File | `edu-average-daily-membership-by-resident-district-fy24.xlsx` |
| Source URL | `https://education.vermont.gov/sites/aoe/files/documents/edu-average-daily-membership-by-resident-district-fy24.xlsx` |
| Retrieved | 2026-07-29 |
| Retrieval method | `manual-download` |
| Retrieved by | James Nadeau |
| SHA-256 | `50f4355c2b6f9d137fbec82d41b32dd7c9326e872550a998546e0e989a94e424` |
| Bytes | 26499 |
| Media type | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| Document type | `aoe_report` |

Downloaded in a browser because `education.vermont.gov` returns HTTP 403 to every
non-browser client — page URLs and direct file URLs alike, byte-identically. This
is a CloudFront WAF refusal after a successful TLS handshake, not the certificate
chain problem `AGENT.md` documents for `legislature.vermont.gov`; that host's AIA
repair does not apply and does not help here.

## What this file contains

Average Daily Membership (ADM) Report for **2022-2023 (ADM-24)** by Resident
District. One sheet named `2024`, 254 data rows, no null cells, all rows joining
to a registry town on `aoe_org_id`.

**Two grade bands** — `Elem ( K - 6)` and `SEC ( 7 - 12)` — totalling 47,301.13
and 36,686.14, grand total 83,987.27.

These are pre-Act-127 bands. Act 127 amended 16 V.S.A. § 4010 effective July 1,
2024, the first day of FY2025, so ADM-25 is the first report published in the
current `K-5 / 6-8 / 9-12` bands. This file's bands **cannot** be reduced to
those: grade 6 falls inside `Elem ( K - 6)` here but inside `Middle ( 6 - 8)` in
ADM-25, and grades 7 and 8 fall inside `SEC ( 7 - 12)` here but inside
`Middle ( 6 - 8)` there. Neither report publishes grade-level detail, so nothing
recovers the split, and § 4010 weights differ across exactly the boundary that
would have to be invented.

Consequence: this file is a cross-check and trend datum. It cannot contribute to a
§ 4001(7) two-year average in current bands, and must not be coerced into one.
