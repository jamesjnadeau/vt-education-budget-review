# Provenance Hash-Collision Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cross-file validate rule that fails loudly when one `sha256` is recorded against two differently-named artifacts in intake provenance — the copy-paste class of bug that put the FY2024 budget book's hash into the FY2025 provenance entry.

**Architecture:** A new *global* (cross-file) rule in `tools/src/validate/rules.ts`. Two small pure functions: `collectArtifactEntries` maps one provenance doc to a flat list of `{ sha256, file, provenanceFile }` refs; `checkArtifactHashCollisions` takes the accumulated refs from *all* intake provenance files and returns an error `Finding` for any `sha256` claimed by two or more artifacts whose filenames differ. The validate CLI accumulates the refs while it already walks intake provenance and calls the collision check once, after the walk. Keeping both functions pure keeps them unit-testable with no filesystem; the CLI change is trivial glue.

**Tech Stack:** TypeScript (ESM, `.ts` imports), tsx, Vitest.

## Global Constraints

- Test runner: `npm test` (`vitest run`) from the repo root. Full validate: `npm run validate`.
- Raw intake artifacts are **never edited** and hashes are **never** rewritten to silence a check — this rule *adds* detection, it must not weaken the existing `hash-verification` rule.
- New rule reports at severity `error` (blocks merge), consistent with `hash-verification`.
- Findings use the existing `Finding` shape: `{ severity, file, rule, message }`. The new rule's `rule` slug is exactly `artifact-hash-collision`.
- The `file` on each finding is the **repo-relative** provenance path (`rel(file)`), matching every other finding in the CLI.
- Scope is **intake** provenance only (`PATHS.intake`, `artifacts[]`). Derived provenance (`derivation.inputs[].pin`) records input *pins*, not source artifacts, and is out of scope — do not touch `checkDerivedProvenance`.
- Match existing code style in `rules.ts` and test style in `rules.test.ts` (Vitest `describe`/`it`/`expect`, `type`-only imports where applicable).

---

## File Structure

- `tools/src/validate/rules.ts` — add the `ProvenanceEntryRef` type and the two pure functions `collectArtifactEntries` and `checkArtifactHashCollisions`, placed in the Provenance section (after `checkProvenanceDoc`, before `checkDerivedProvenance`).
- `tools/src/validate/rules.test.ts` — add unit tests for both new functions.
- `tools/src/cli/validate.ts` — accumulate refs in the existing intake-provenance loop and call the collision check once after it.

---

## Task 1: Pure collision-detection rule + unit tests

**Files:**
- Modify: `tools/src/validate/rules.ts` (add code in the Provenance section, immediately after `checkProvenanceDoc` ends and before `checkDerivedProvenance`, around line 330)
- Test: `tools/src/validate/rules.test.ts`

**Interfaces:**
- Consumes: the existing `Finding` type and `ProvenanceArtifact` / `ProvenanceDoc` interfaces already declared in `rules.ts` (lines ~184–196).
- Produces (later tasks rely on these exact signatures):
  - `export interface ProvenanceEntryRef { readonly sha256: string; readonly file: string; readonly provenanceFile: string; }`
  - `export function collectArtifactEntries(doc: ProvenanceDoc, provenanceFile: string): ProvenanceEntryRef[]`
  - `export function checkArtifactHashCollisions(entries: readonly ProvenanceEntryRef[]): Finding[]`

- [ ] **Step 1: Write the failing tests**

Add to `tools/src/validate/rules.test.ts`. First extend the import block at the top so it also pulls the new symbols:

```ts
import {
  checkAdmCrossCheck,
  checkArtifactHashCollisions,
  checkNullAccounting,
  checkRegistryRefs,
  collectArtifactEntries,
  collectNullPaths,
  type BudgetRecord,
  type ProvenanceEntryRef,
} from './rules.ts';
```

Then append this block to the end of the file:

```ts
describe('collectArtifactEntries', () => {
  it('flattens a provenance doc into one ref per artifact, tagged with its file', () => {
    const doc = {
      entity: 'su/addison-central',
      fiscal_year: 2025,
      artifacts: [
        { file: 'a.pdf', sha256: 'a'.repeat(64) },
        { file: 'b.pdf', sha256: 'b'.repeat(64) },
      ],
    } as never;
    const refs = collectArtifactEntries(doc, 'intake/su-x/fy2025/provenance.yaml');
    expect(refs).toEqual([
      { sha256: 'a'.repeat(64), file: 'a.pdf', provenanceFile: 'intake/su-x/fy2025/provenance.yaml' },
      { sha256: 'b'.repeat(64), file: 'b.pdf', provenanceFile: 'intake/su-x/fy2025/provenance.yaml' },
    ]);
  });
});

describe('checkArtifactHashCollisions', () => {
  const ref = (over: Partial<ProvenanceEntryRef>): ProvenanceEntryRef => ({
    sha256: 'a'.repeat(64),
    file: 'x.pdf',
    provenanceFile: 'intake/su-x/fy2025/provenance.yaml',
    ...over,
  });

  it('passes when every sha256 is unique', () => {
    const findings = checkArtifactHashCollisions([
      ref({ sha256: 'a'.repeat(64), file: 'a.pdf' }),
      ref({ sha256: 'b'.repeat(64), file: 'b.pdf' }),
    ]);
    expect(findings).toHaveLength(0);
  });

  it('errors when one sha256 is claimed by two differently-named artifacts in different files', () => {
    // The exact FY24-hash-pasted-into-FY25 bug this rule exists to catch.
    const dup = '8'.repeat(64);
    const findings = checkArtifactHashCollisions([
      ref({ sha256: dup, file: 'ACSD Budget Book FY24.pdf', provenanceFile: 'intake/su-addison-central/fy2024/provenance.yaml' }),
      ref({ sha256: dup, file: 'FY25BudgetBookMasterFinalv1.pdf', provenanceFile: 'intake/su-addison-central/fy2025/provenance.yaml' }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('error');
    expect(findings[0]?.rule).toBe('artifact-hash-collision');
    // Message names the shared hash and both artifacts so the fix is obvious.
    expect(findings[0]?.message).toContain(dup);
    expect(findings[0]?.message).toContain('ACSD Budget Book FY24.pdf');
    expect(findings[0]?.message).toContain('FY25BudgetBookMasterFinalv1.pdf');
  });

  it('errors when two artifacts inside the SAME provenance file share a hash', () => {
    const dup = 'c'.repeat(64);
    const findings = checkArtifactHashCollisions([
      ref({ sha256: dup, file: 'one.pdf' }),
      ref({ sha256: dup, file: 'two.pdf' }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('error');
  });

  it('does NOT flag the same bytes recorded under the same filename (legitimate reuse)', () => {
    // e.g. one combined annual report committed under identical names across
    // two fiscal-year dirs. Identical basename => same document, not a paste.
    const dup = 'd'.repeat(64);
    const findings = checkArtifactHashCollisions([
      ref({ sha256: dup, file: 'Annual Report.pdf', provenanceFile: 'intake/su-x/fy2024/provenance.yaml' }),
      ref({ sha256: dup, file: 'Annual Report.pdf', provenanceFile: 'intake/su-x/fy2025/provenance.yaml' }),
    ]);
    expect(findings).toHaveLength(0);
  });

  it('emits one finding per colliding hash group, not one per member', () => {
    const dup = 'e'.repeat(64);
    const findings = checkArtifactHashCollisions([
      ref({ sha256: dup, file: 'a.pdf' }),
      ref({ sha256: dup, file: 'b.pdf' }),
      ref({ sha256: dup, file: 'c.pdf' }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('a.pdf');
    expect(findings[0]?.message).toContain('b.pdf');
    expect(findings[0]?.message).toContain('c.pdf');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- rules.test.ts`
Expected: FAIL — `collectArtifactEntries` / `checkArtifactHashCollisions` / `ProvenanceEntryRef` are not exported (import error or "is not a function").

- [ ] **Step 3: Implement the two functions**

In `tools/src/validate/rules.ts`, find where `checkProvenanceDoc` ends (just before the `/**` doc comment for `checkDerivedProvenance`, around line 330) and insert:

```ts
export interface ProvenanceEntryRef {
  readonly sha256: string;
  readonly file: string;
  readonly provenanceFile: string;
}

/**
 * Flattens one provenance document into a ref per artifact, each tagged with
 * the provenance file it came from. The CLI accumulates these across every
 * intake provenance file so `checkArtifactHashCollisions` can see them together.
 */
export function collectArtifactEntries(
  doc: ProvenanceDoc,
  provenanceFile: string,
): ProvenanceEntryRef[] {
  return doc.artifacts.map((a) => ({
    sha256: a.sha256,
    file: a.file,
    provenanceFile,
  }));
}

/**
 * A sha256 identifies bytes. If the same sha256 is recorded for two artifacts
 * with different filenames, those two entries claim that one set of bytes is
 * two different source documents -- impossible, and almost always a hash
 * copy-pasted between sibling provenance entries (the FY24 book's hash landing
 * in the FY25 entry). `hash-verification` only catches this once the wrong
 * artifact's real bytes are materialised and differ; this catches the paste at
 * authoring time, and points straight at the sibling it was copied from.
 *
 * Identical bytes under an identical filename are left alone: that is one
 * document legitimately reused (e.g. a combined report committed under the same
 * name across two fiscal-year directories), not a paste.
 */
export function checkArtifactHashCollisions(
  entries: readonly ProvenanceEntryRef[],
): Finding[] {
  const byHash = new Map<string, ProvenanceEntryRef[]>();
  for (const entry of entries) {
    const bucket = byHash.get(entry.sha256);
    if (bucket) bucket.push(entry);
    else byHash.set(entry.sha256, [entry]);
  }

  const findings: Finding[] = [];
  for (const [sha256, group] of byHash) {
    const distinctNames = new Set(group.map((e) => e.file));
    if (distinctNames.size < 2) continue;

    const members = group
      .map((e) => `"${e.file}" (${e.provenanceFile})`)
      .join(', ');
    findings.push({
      severity: 'error',
      // Report against the lexicographically-first provenance file so the
      // finding is deterministic; the message names every member.
      file: [...group].sort((a, b) => a.provenanceFile.localeCompare(b.provenanceFile))[0]!
        .provenanceFile,
      rule: 'artifact-hash-collision',
      message:
        `sha256 ${sha256} is recorded for more than one artifact: ${members}. ` +
        `One set of bytes cannot be two different source documents -- this is almost ` +
        `always a hash copy-pasted between provenance entries. Verify each artifact and ` +
        `record its own hash; do not edit the raw artifacts.`,
    });
  }
  return findings;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- rules.test.ts`
Expected: PASS (all new tests green, existing tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add tools/src/validate/rules.ts tools/src/validate/rules.test.ts
git commit -m "feat(validate): detect one sha256 recorded for two artifacts"
```

---

## Task 2: Wire the collision check into the validate CLI

**Files:**
- Modify: `tools/src/cli/validate.ts` (the intake-provenance loop at ~lines 218–229, and just after it)

**Interfaces:**
- Consumes: `collectArtifactEntries`, `checkArtifactHashCollisions`, and `type ProvenanceEntryRef` from `../validate/rules.ts` (Task 1), plus `rel` (already imported at line 27).
- Produces: no new exported symbols; the CLI now emits `artifact-hash-collision` findings.

- [ ] **Step 1: Add the two functions (and the type) to the rules import block**

In `tools/src/cli/validate.ts`, the multi-name import from `../validate/rules.ts` begins at line 31. Add the new names in alphabetical position and add a `type` import for `ProvenanceEntryRef`:

```ts
import {
  checkAdmCrossCheck,
  checkArtifactHashCollisions,
  checkCorrections,
  // ...existing names unchanged...
  checkNullAccounting,
  checkProvenance,
  checkProvenanceDoc,
  collectArtifactEntries,
  // ...existing names unchanged...
  type ProvenanceEntryRef,
} from '../validate/rules.ts';
```

(Keep every existing imported name — only add `checkArtifactHashCollisions`, `collectArtifactEntries`, and the `type ProvenanceEntryRef`. Match the block's existing ordering convention.)

- [ ] **Step 2: Accumulate refs in the intake-provenance loop and check after it**

Replace the intake-provenance block (currently lines 218–229):

```ts
  // --- intake provenance --------------------------------------------------
  for (const file of walkFiles(PATHS.intake, (n) => n === 'provenance.yaml')) {
    counts.provenance++;
    const data = readData(file);
    findings.push(...schemaFindings('provenance', data, file));
    findings.push(...checkRegistryRefs(data, file, registry));
    if (Array.isArray((data as { artifacts?: unknown }).artifacts)) {
      findings.push(
        ...checkProvenanceDoc(data as never, file, dirname(file), { verifyHashes, requireFetched }),
      );
    }
  }
```

with:

```ts
  // --- intake provenance --------------------------------------------------
  const artifactRefs: ProvenanceEntryRef[] = [];
  for (const file of walkFiles(PATHS.intake, (n) => n === 'provenance.yaml')) {
    counts.provenance++;
    const data = readData(file);
    findings.push(...schemaFindings('provenance', data, file));
    findings.push(...checkRegistryRefs(data, file, registry));
    if (Array.isArray((data as { artifacts?: unknown }).artifacts)) {
      findings.push(
        ...checkProvenanceDoc(data as never, file, dirname(file), { verifyHashes, requireFetched }),
      );
      artifactRefs.push(...collectArtifactEntries(data as never, rel(file)));
    }
  }
  // One sha256 recorded against two differently-named artifacts is a
  // copy-pasted hash. This needs every intake provenance file at once, so it
  // runs after the walk rather than per file.
  findings.push(...checkArtifactHashCollisions(artifactRefs));
```

- [ ] **Step 3: Verify the real repo still passes (no false positive on genuine data)**

Run: `npm run validate`
Expected: `0 error(s)` (the same pre-existing `parameters-unverified` warnings as before, no `artifact-hash-collision` finding). This confirms the 5 current provenance files hold no duplicate hashes.

- [ ] **Step 4: Verify the rule fires on a real duplicate (temporary, reverted)**

Temporarily reintroduce the original bug into a WORKING-COPY only, run validate, confirm it is caught, then restore:

```bash
cp intake/su-addison-central/fy2025/provenance.yaml /tmp/prov-fy25.bak
sed -i 's/^\(\s*sha256:\).*/\1 8bb3efd5e7fb16cc05db496f4f96a854bc0589dc4dc1b9636029783d955fe43a/' intake/su-addison-central/fy2025/provenance.yaml
npm run validate 2>&1 | grep -E "artifact-hash-collision|error\(s\)"
cp /tmp/prov-fy25.bak intake/su-addison-central/fy2025/provenance.yaml
```

Expected: the grep shows an `ERROR ... [artifact-hash-collision]` line naming both the FY24 and FY25 books, and a non-zero error count. After the restoring `cp`, `git status` shows `intake/su-addison-central/fy2025/provenance.yaml` unmodified (clean).

Note: this temporarily makes the FY25 entry's recorded hash disagree with the PDF again, so `hash-verification` will *also* fire in this step — both rules catching it is expected and fine. The point is confirming `artifact-hash-collision` appears.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS (all suites green).

- [ ] **Step 6: Commit**

```bash
git add tools/src/cli/validate.ts
git commit -m "feat(validate): run artifact-hash-collision across intake provenance"
```

---

## Self-Review

**1. Spec coverage** ("check across files for this mistake"):
- Detect one sha256 across two artifacts → Task 1 `checkArtifactHashCollisions`. ✓
- Across *files* (not just within one) → refs accumulated across the whole intake walk in Task 2, checked together. ✓
- Fail loudly at authoring time → severity `error`, message names the sibling it was pasted from. ✓
- No false positive on genuine data → Task 2 Step 3 runs the real repo; the same-filename carve-out protects legitimate reuse (Task 1 test). ✓
- Proven to fire on the actual historical bug → Task 2 Step 4. ✓

**2. Placeholder scan:** No TBD/"handle appropriately"/"write tests for the above" — every code and test step carries literal content. ✓

**3. Type consistency:** `ProvenanceEntryRef` fields (`sha256`, `file`, `provenanceFile`) are identical across the type declaration, `collectArtifactEntries` output, the CLI accumulation, and every test. Function names `collectArtifactEntries` / `checkArtifactHashCollisions` and rule slug `artifact-hash-collision` are spelled identically in Tasks 1 and 2. `collectArtifactEntries` takes `(doc, provenanceFile)` and the CLI passes `(data as never, rel(file))` — the `provenanceFile` is repo-relative, matching how findings are keyed elsewhere. ✓

**Design note (intentional scope):** Same-bytes/same-filename reuse is deliberately not flagged, so if a genuine collision with *different* filenames ever arises it will error and require a human decision — acceptable, since that is exactly the ambiguous case worth a human look. Derived provenance is out of scope by design (it pins inputs, not source artifacts). Both are documented in Global Constraints rather than coded around (YAGNI).
