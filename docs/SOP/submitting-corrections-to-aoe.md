# SOP: submitting corrections to AOE

This is the operator procedure for the correction workflow: recording a value the
project asserts against what the Agency of Education publishes, sending it to AOE,
and marking that it was sent. The design behind it is in
[`docs/superpowers/specs/2026-07-31-registry-corrections-design.md`](../superpowers/specs/2026-07-31-registry-corrections-design.md);
this document is the steps.

The whole workflow is one CLI over one file:

- The file is [`registry/corrections.yaml`](../../registry/corrections.yaml) — the
  source of truth, hand-authored.
- The CLI is `npm run registry:corrections`, in four forms (list, `--report`,
  `--csv`, `--sent`).

A correction is **a claim about a named source**, not a local edit. It records the
value AOE published when the claim was made, so a later sync can ask the only
question that matters — does AOE still publish the thing we objected to? — and
retire the claim when the answer becomes no.

## Before you start

The registry must be synced, so the CLI can resolve slugs to the OrgIDs and names
AOE uses:

```bash
npm run registry:sync
```

## Step 1 — Record the correction

Add an entry to `registry/corrections.yaml`. The fields a human writes:

- `slug` — the repo entity, e.g. `su/addison-central`.
- `field` — a correctable field. The whitelist is `FIELD_CLASS` in
  [`tools/src/registry/corrections.ts`](../../tools/src/registry/corrections.ts);
  identity keys (`slug`, `aoe_org_id`, `type`) are deliberately not correctable.
- `aoe_value` — what AOE publishes now (the claim's premise) and
  `aoe_value_observed` — the `registry/raw/<date>/` snapshot you read it from.
- `our_value` — what it should be.
- `evidence` — tiered by what the field can break. A `contact` field (`website`,
  `mailing_city`) needs a `retrieved_url`; an `identity`, `structural`, or
  `spatial` field needs a `cited_document` (or, for spatial, a `derived_artifact`).
  The tier is enforced by `checkCorrections`; a wrong `operated_by` moves model
  output, so it earns a document and a quoted operative sentence, the same burden
  [`docs/parameter-verification.md`](../parameter-verification.md) puts on a
  statutory weight.
- `submitted_by`, `submitted_date`.
- `status: open`. Leave `sent_date`, `recipient`, and `note` off (they default to
  null); the `--sent` command fills them.

Then check your work:

```bash
npm run validate
```

## Step 2 — Review the open set

```bash
npm run registry:corrections
```

Prints every correction and, for each one still outstanding with AOE, a line in
**AOE's identifiers** (`SU003 website: … -> …`). This is the set that will be sent.

## Step 3 — Generate the deliverable

```bash
npm run registry:corrections -- --report --csv
```

Writes two files to `derived/corrections/`, dated today:

- `report-<date>.md` — the email body, written entirely in AOE's OrgIDs and names,
  with no repo slugs. This is what a data steward who has never seen this
  repository can open and act on.
- `corrections-<date>.csv` — the same set, sortable.

These are correspondence, not a data product; they are gitignored and regenerated
on demand.

## Step 4 — Send it to AOE (a human step)

**The channel is email to a person at AOE** — not a portal, not an API, not a pull
request against their data. AOE also blocks automated clients, so this step cannot
be automated and is not done by the CLI: **you** email the report (and CSV) to your
AOE contact.

## Step 5 — Record that it was sent

Once the email is actually sent:

```bash
npm run registry:corrections -- --sent --to data-contact@vermont.gov
```

This flips every open-and-outstanding correction to `status: sent` and stamps each
with `sent_date` and `recipient`. It selects **exactly the set `--report` would
send**, so the batch you stamped can never drift from the batch you emailed.

Options:

- `--to <email>` — **required.** The address the batch went to. A sent correction
  that names no recipient is a claim without a receipt, a state `validate` refuses.
- `--note "<text>"` — optional. Recorded on each correction in the batch.
- `--date <YYYY-MM-DD>` — optional, defaults to today. Use it when you emailed on a
  different day than you run the command.

The command writes `registry/corrections.yaml` in place, preserving its comments,
and prints what it changed. If nothing is open, it says so and changes nothing.

Do **not** hand-edit `status: sent` into the file. The `--sent` command exists so
the recipient and date are always recorded together; a hand-edit that omits them is
caught by `validate` (`correction-sent-incomplete`), not silently accepted.

## Step 6 — Review and commit

```bash
git diff registry/corrections.yaml
```

Confirm the batch, then commit. The commit is the audit trail.

## Afterwards — adoption is computed, not written

You never hand-write "AOE adopted this." Each `npm run registry:sync` compares what
AOE publishes now against `aoe_value` and `our_value` and computes the upstream
state (`adopted` / `outstanding` / `diverged`). When AOE comes to publish `our_value`,
the sync retires the correction on its own and it drops out of the report. Storing
adoption by hand would mean maintaining a fact about AOE's data inside a file AOE
never touches — the exact drift this workflow exists to prevent.

## Withdrawing a claim

If a correction turns out to be wrong or moot, set its `status: withdrawn` by hand.
A withdrawn claim is not applied, not reported, and not marked sent. This is the one
status transition the CLI does not manage, because it is a judgement that the claim
was mistaken, not a step in sending it.

## The statuses, in one place

| `status` | Meaning | Who sets it |
|---|---|---|
| `open` | A live claim, not yet sent | You, when recording it |
| `sent` | Emailed to AOE; carries `recipient` and `sent_date` | `--sent` |
| `withdrawn` | Retracted as mistaken or moot | You, by hand |

Adoption (`adopted` / `outstanding` / `diverged`) is a separate axis, computed each
sync — never written.
