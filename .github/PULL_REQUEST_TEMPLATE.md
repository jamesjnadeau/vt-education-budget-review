<!--
Thanks for contributing. Most pull requests here are one of three kinds; fill in
the section that applies and delete the rest.

Validation runs automatically and will tell you what is missing, so you do not
need to get this perfect by hand.
-->

## What this changes

<!-- One or two sentences. -->

---

### If you are adding a budget document to `intake/`

Most budget documents do not come in as a pull request at all: the coverage
dashboard's issue form collects the file and its provenance, and a bot opens the
PR for you with the hash already computed. You only need to open one of these by
hand for a document **over GitHub's 25 MB issue-attachment limit**, which the
form cannot accept.

If that is you, provenance is still the product, so `provenance.yaml` is not
optional — it is what makes the number citable later:

- **Entity:** <!-- e.g. su/washington-central -->
- **Fiscal year:**
- **Where did you get it?** <!-- Direct URL if there is one. -->
- **When did you retrieve it?**
- **How?** <!-- website download / emailed by the district / picked up at a meeting / records request -->
- **Is this the document exactly as released?** <!-- Raw artifacts are never edited, cropped, or re-saved. If you had to alter it in any way, say so. -->

Write those into a `provenance.yaml` beside the file. If it is missing or
incomplete, CI will tell you what it needs.

---

### If you are adding or changing a warehouse record

- **Source artifact:** <!-- path under intake/ -->
- **Pages or sections used:**
- **Did any figure disagree with what you expected?** <!-- Record it in lines_flagged rather than reconciling it. A district's printed per-pupil figure differing from a recomputation is a finding, not a bug. -->

Every null in a money field must be accounted for in `not_published` — with who
confirmed it and when — or in `lines_flagged`. Validation will reject the record
otherwise. This is what makes a blank mean "the district did not publish this"
instead of "nobody looked".

---

### If you are changing a statutory parameter or citation

- **Which statute did you read?** <!-- Section and subsection. -->
- **Did you read the current text, or a summary?** <!-- Only the current text counts. -->
- **Paste the operative sentence:**

<!--
Reminder from docs/parameter-verification.md: a parameter may be marked
verified: true only by a person who has read the operative sentence in current
statute text. Not a summary, not an agency table, not a previous version of the
file, not a language model's recollection. Verify the STRUCTURE too — which
weights exist, what they apply to, whether they multiply or add — since correct
numbers in a wrong structure produce confident wrong answers.
-->

---

### Checklist

- [ ] `npm run validate` passes locally (or I am relying on CI to tell me what is wrong)
- [ ] I have not edited any file under `intake/` — raw artifacts are never changed
- [ ] If I marked something `not_published`, I actually opened the document and looked
