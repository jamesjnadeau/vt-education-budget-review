# Notes for agents and contributors working on this repo

## Write all public-facing text at a 5th-grade reading level

Every word a visitor can read on the site — page copy, headings, navigation labels,
button and form labels, table captions, status chips, error and empty-state messages,
and page titles and meta descriptions — must be written so any Vermonter can understand
it. Aim for roughly a **5th-grade reading level**.

This is not about dumbing the site down. Its whole purpose is that everyone in Vermont
can understand what is being said about their schools and taxes. Precision still comes
first — never flatten a real distinction (the four kinds of blank, "confirmed not
published" vs. "missing", "proposed, not yet law") to make a sentence shorter.

How to hit it:

- Short sentences, one idea each. Prefer active voice ("we haven't checked this yet"
  over "this has not been verified").
- Everyday words in place of jargon where the jargon is only style: "comes from a public
  source you can check" not "is traceable to a public source"; "master list" not
  "canonical registry"; "the math engine" not "the formula engine".
- **Keep** the terms that are genuinely load-bearing — proper and legal names like
  *supervisory union*, *Act 73*, *common level of appraisal*, *average daily
  membership* — but add a plain-language gloss the first time each appears.
- Read it aloud. If it sounds like a statute or a spec, rewrite it.

The technical notes in this file, code comments, commit messages, and `docs/` are for
contributors, not the public, and are exempt.

## legislature.vermont.gov serves an incomplete TLS certificate chain

**Symptom.** Any attempt to fetch statute text fails with:

```
unable to verify the first certificate
UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

This affects Node's `fetch`/`undici`, most agent web-fetch tools, and anything else
using a strict chain-building TLS client. Browsers and `curl` are unaffected, which is
why the site looks fine when you check it by hand and fails from a script.

**Cause.** The server presents only its leaf certificate and omits the GlobalSign
intermediate:

| | |
|---|---|
| Leaf | `CN=legislature.vermont.gov`, `O=State of Vermont` |
| Issuer (not sent) | `CN=GlobalSign RSA OV SSL CA 2018` |
| Root (in system store) | `GlobalSign Root CA - R3` |

The certificate itself is valid and issued by a real CA. This is a server
misconfiguration, not a security problem. Browsers paper over it by fetching the
missing intermediate from the leaf's Authority Information Access (AIA) extension;
Node does not do AIA chasing.

**The fix, which preserves full verification.** Fetch the intermediate from the AIA
URL in the leaf certificate and pass it as an additional CA. The chain still has to
terminate at a GlobalSign root already in the system trust store — nothing is
bypassed, the missing link is simply supplied.

```js
import tls from 'node:tls';
import https from 'node:https';
import { X509Certificate } from 'node:crypto';

// From the leaf's AIA extension: "CA Issuers - URI".
const AIA = 'http://secure.globalsign.com/cacert/gsrsaovsslca2018.crt';
const intermediate = new X509Certificate(await downloadDer(AIA));

const agent = new https.Agent({
  ca: [...tls.rootCertificates, intermediate.toString()],
  // rejectUnauthorized stays at its default of true. Verification is FULL.
});
```

**Do not "fix" this with `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`,
or `curl --insecure.`** Statute text is the authority for every published number on
this site. Fetching it over a connection you have not authenticated means you cannot
say where a number came from, which is the one thing this project exists to be able to
say. If the AIA repair ever stops working, fetch by hand and paste the text in — do
not weaken verification.

The AIA URL is plain HTTP, which is correct and standard for CA certificate
distribution: the downloaded certificate is self-validating, because it must chain to
an already-trusted root and its signature is checked.

**Working implementation:** `tools/src/statute/fetch.ts`.

## education.vermont.gov blocks automated clients

`education.vermont.gov` returns **HTTP 403** to non-browser user agents, including for
pages that are public in a browser. There is no clean programmatic workaround, and
attempting to defeat the block would be both rude and fragile.

AOE guidance pages are useful for cross-checking a reading, but they are never the
citation of record — the site's position is independent verification of the state's
figures, which requires reading the same statute the state read. When you need
something from an AOE page, fetch it by hand and record it as a manual retrieval in
the relevant provenance file.

The AOE **Public Data API** at `datacollection.education.vermont.gov` is a different
host and works fine unauthenticated. That is what the registry sync uses.

## Quirks in the AOE Public Data API

Documented in full in `tools/src/registry/aoe-client.ts` and `sync.ts`. The short list:

1. **The primary key has two spellings.** `OrgID` on `organizations`,
   `supervisoryUnions` and `closed_organizations`; `OrgId` on `towns`, `publicSchools`
   and `unionDistricts`.

2. **`ParentOrg` and `OperatedBy` mean opposite things** depending on entity type. For
   a town, `OperatedBy` is its SU and `ParentOrg` is its district. For a school it is
   the other way round. Reading either uniformly produces a registry that looks
   plausible and is wrong about who operates what.

3. **Some entities are their own parent.** Supervisory unions, independent academies
   and tech centers list their own org ID in `ParentOrg`. Treated literally this puts
   an entity inside its own hierarchy.

4. **The live responses carry fields the OpenAPI spec does not declare** — `OrgType`,
   `OperatedBy` and `EdFi_ID` all appear on `supervisoryUnions` despite the spec's
   `Organization` schema listing none of them. Do not generate a client from the spec
   and trust it; snapshot the responses.

5. **There is a record named `Test`** (org ID `Test`, typed "Distance Learning (IS)").
   Filtered by `tools/src/registry/placeholder.ts`.

6. **`UNKNOWN` is a legitimate reporting record, not a placeholder.** It is how
   residency is recorded for pupils whose town is not established, and other records
   reference it. It is kept, flagged `reporting_only: true`, and **awarded no ADM** —
   it must never be counted as a town, in membership or in any coverage total.

7. **Head Start typing is correct.** A school district that is also a Head Start
   grantee carries a separate `HDS` org ID. This is accurate, not an upstream error;
   the district, its town and its schools are tracked under their own records.

8. **Two organizations are mistyped as supervisory unions** and must be filtered out:
   the **University of Vermont** (`HE001`, higher education) and the **Department of
   Corrections** (`SU099`, adult education inside state facilities, grades `AW`). Both
   are published on the `supervisoryUnions` endpoint typed `Supervisory Union (SU)` —
   the same type a real SU carries — so only the stable org ID tells them apart. Left
   in, each stands as a permanent red gap on the coverage dashboard for a school-district
   budget it will never publish. Filtered by `UNTRACKED_ORG_IDS` in
   `tools/src/registry/slugs.ts` and routed to the sync's "deliberately not tracked"
   list, never dropped silently. This is the identity-keyed sibling of the OrgType-keyed
   `UNTRACKED_ORG_TYPES` (item 7); reach for it only when AOE mistypes a specific org
   under a type that is otherwise tracked.

9. **Two SU websites are published without a URL scheme** (`www.brsu.org`,
   `www.orangesouthwest.org`), so they are not valid URIs until normalized.

## The rule that matters most here

The engine will not produce a number from a parameter whose citation is not
`verified: true`. That is enforced in `model/src/node.ts` and tested. If you find
yourself wanting to fill in a weight from memory, from a secondary source, or from a
previous version of a parameter file, read `docs/parameter-verification.md` first —
this area of Vermont law has been amended in most recent sessions, and a remembered
weight is quite likely to be a repealed one.
