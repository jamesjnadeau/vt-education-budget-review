#!/usr/bin/env node
/**
 * The gatekeeper.
 *
 *   npm run validate                  everything, hashes included
 *   npm run validate -- --no-hashes   skip hash verification (unfetched LFS)
 *
 * Every PR runs this. Nothing reaches `main` -- and therefore nothing reaches
 * the site -- without passing, which is what stands in for the trust function
 * an admin login would otherwise serve.
 *
 * Errors block. Warnings are printed loudly and do not, because some
 * disagreements are findings to publish rather than bugs to fix: a district's
 * printed per-pupil figure differing from our recomputation is exactly the
 * discrepancy the plan says to preserve and never silently reconcile.
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { parseParameterSet, unverifiedParameters } from '@vt-budget/model';
import { aoeBandsFor } from '../adm-lookup.ts';
import { buildAdmPublication } from '../aoe/adm/publish.ts';
import { walkFiles } from '../fs-walk.ts';
import { PATHS, REPO_ROOT, rel } from '../paths.ts';
import { readCorrections } from '../registry/corrections.ts';
import { readRegistry, readSnapshotIfPresent } from '../registry/store.ts';
import type { RegistryEntity } from '../registry/types.ts';
import {
  checkAdmCrossCheck,
  checkCorrections,
  checkDerivedProvenance,
  checkLandAreaOnly,
  checkNullAccounting,
  checkPlaceholderEntities,
  checkProvenance,
  checkProvenanceDoc,
  checkRegistryRefs,
  formatFinding,
  summarize,
  type BudgetRecord,
  type Finding,
  type SnapshotReader,
} from '../validate/rules.ts';
import { validateAgainst, type SchemaName } from '../validate/schemas.ts';

function readData(path: string): unknown {
  const text = readFileSync(path, 'utf8');
  return path.endsWith('.json') ? JSON.parse(text) : parseYaml(text);
}

function schemaFindings(schema: SchemaName, data: unknown, file: string): Finding[] {
  return validateAgainst(schema, data).map((e) => ({
    severity: 'error' as const,
    file,
    rule: `schema:${schema}`,
    message: `${e.path} ${e.message}`,
  }));
}

/**
 * Reads and checks the corrections register, exported (rather than inlined in
 * `main`) so a blank or malformed register can be exercised directly, without
 * standing up the whole CLI.
 *
 * `readCorrections`, not `readData`: a blank or comment-only register parses
 * to `null`, a state its own docstring declares legitimate (no corrections
 * yet), but handing a bare `null` to `schemaFindings` trips the schema's
 * "must be an object" check for a file that is not actually malformed.
 * `readCorrections` normalizes that case to `{schema_version, corrections:
 * []}` and reserves throwing for genuine malformation (unrecognized keys, a
 * non-array `corrections`). A validator exists so problems arrive as
 * findings, not stack traces, so that throw is caught here rather than left
 * to crash the whole run.
 */
export function correctionsFindings(
  path: string,
  registry: ReadonlyMap<string, RegistryEntity>,
  // The premise check reads the snapshot each claim names. Defaulted rather
  // than required so `npm run validate` needs no wiring at the call site, and
  // parameterized so a test can hand it a snapshot of its own without writing
  // one into registry/raw/.
  readSnapshotFor: SnapshotReader = readSnapshotIfPresent,
): Finding[] {
  // Only readCorrections' own parse is fallible in a way this function needs
  // to catch (bad top-level shape, not a schema violation on one record).
  // schemaFindings and checkCorrections run OUTSIDE the try: they collect
  // findings rather than throw, by design, so a broader try would catch a bug
  // in one of them -- e.g. checkCorrections dereferencing a field a
  // schema-invalid record omits -- and misreport it as the register itself
  // being unreadable, discarding the precise schema finding that was already
  // sitting in the array the abandoned block never got to return.
  let register;
  try {
    register = readCorrections(path);
  } catch (error) {
    return [
      {
        severity: 'error',
        file: rel(path),
        rule: 'corrections-unreadable',
        message: error instanceof Error ? error.message : String(error),
      },
    ];
  }

  return [
    ...schemaFindings('corrections', register, path),
    ...checkCorrections(register.corrections, rel(path), registry, readSnapshotFor),
  ];
}

/**
 * Absolute paths of the artifacts CI fetched selectively this run, read from
 * `VALIDATE_CHANGED_ARTIFACTS` (newline- or whitespace-separated, repo-relative
 * -- exactly the list the workflow feeds `git lfs pull --include`). An artifact
 * in this set that is still a pointer is a hard error rather than a warning:
 * the selective fetch was supposed to materialise it and did not. Empty off CI,
 * where a full `git lfs pull` (or none) is in effect and an unfetched pointer
 * is the ordinary, non-blocking warning.
 */
function requireFetchedFromEnv(): ReadonlySet<string> {
  const raw = process.env['VALIDATE_CHANGED_ARTIFACTS'];
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/\s+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => join(REPO_ROOT, p)),
  );
}

function main(): number {
  const verifyHashes = !process.argv.includes('--no-hashes');
  const requireFetched = requireFetchedFromEnv();
  const findings: Finding[] = [];
  const counts = {
    registry: 0,
    warehouse: 0,
    provenance: 0,
    collectors: 0,
    parameters: 0,
    groupings: 0,
    derived: 0,
  };

  const registry = readRegistry();
  if (registry.size === 0) {
    findings.push({
      severity: 'error',
      file: rel(PATHS.registryEntities),
      rule: 'registry-empty',
      message: 'The registry is empty. Run `npm run registry:sync` before validating.',
    });
  }

  // --- registry -----------------------------------------------------------
  for (const file of walkFiles(PATHS.registryEntities, (n) => n.endsWith('.json'))) {
    counts.registry++;
    const data = readData(file);
    findings.push(...schemaFindings('registry', data, file));
    findings.push(...checkPlaceholderEntities(data, file));
  }

  // --- corrections register -----------------------------------------------
  findings.push(...correctionsFindings(PATHS.corrections, registry));

  // --- groupings ----------------------------------------------------------
  try {
    const groupings = readData(PATHS.groupings);
    counts.groupings++;
    findings.push(...schemaFindings('grouping', groupings, PATHS.groupings));
    findings.push(...checkRegistryRefs(groupings, PATHS.groupings, registry));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  // --- parameters ---------------------------------------------------------
  for (const file of walkFiles(PATHS.parameters, (n) => n.endsWith('.yaml'))) {
    counts.parameters++;
    const data = readData(file);
    findings.push(...schemaFindings('parameters', data, file));
    try {
      const set = parseParameterSet(data);
      const unverified = unverifiedParameters(set);
      if (unverified.length > 0) {
        findings.push({
          severity: 'warning',
          file,
          rule: 'parameters-unverified',
          message:
            `${unverified.length} of ${set.parameters.size} parameter(s) are not verified against ` +
            `current statute text, so the engine will decline to compute from them: ` +
            `${unverified.map((p) => p.key).join(', ')}. See docs/parameter-verification.md.`,
        });
      }
    } catch (error) {
      findings.push({
        severity: 'error',
        file,
        rule: 'parameters-parse',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // --- collectors ---------------------------------------------------------
  for (const file of walkFiles(PATHS.collectors, (n) => n === 'config.yaml')) {
    counts.collectors++;
    const data = readData(file);
    findings.push(...schemaFindings('collector', data, file));
    findings.push(...checkRegistryRefs(data, file, registry));
  }

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

  // --- committed derived products -----------------------------------------
  // These have no source URL, so their provenance answers a different question:
  // what was run, on what inputs, at what version. A derived product with no
  // provenance beside it is a number nobody can re-derive.
  for (const file of walkFiles(PATHS.derived, (n) => n.endsWith('.yaml'))) {
    counts.derived++;
    const data = readData(file);
    if (basename(file) === 'provenance.yaml') {
      findings.push(...schemaFindings('provenance', data, file));
      findings.push(...checkDerivedProvenance(data, file));
      continue;
    }
    findings.push(...schemaFindings('derived-municipality', data, file));
    findings.push(...checkRegistryRefs(data, file, registry));

    const provenancePath = join(dirname(file), 'provenance.yaml');
    if (!existsSync(provenancePath)) {
      findings.push({
        severity: 'error',
        file,
        rule: 'derived-provenance-exists',
        message:
          'no provenance.yaml beside this derived product. A committed derived file without ' +
          'the algorithm, version, pinned inputs and run that produced it cannot be reproduced, ' +
          'and an unreproducible derived figure is worse than no figure.',
      });
    }
  }

  // --- AOE source manifests -----------------------------------------------
  for (const file of walkFiles(PATHS.intake, (n) => n === 'source.yaml')) {
    const data = readData(file);
    findings.push(...schemaFindings('aoe-source', data, file));
    findings.push(...checkRegistryRefs(data, file, registry));
  }

  // --- AOE publication, built once for the cross-check below --------------
  const admDir = join(PATHS.warehouse, 'aoe-adm');
  const admRecords = walkFiles(admDir, (n) => /^adm\d{2}\.yaml$/.test(n)).map((file) => readData(file));
  const admPublication =
    admRecords.length > 0
      ? buildAdmPublication(admRecords, registry, new Date(0).toISOString())
      : { generated: '', years: [], gaps: [] as unknown };

  // --- warehouse ----------------------------------------------------------
  for (const file of walkFiles(PATHS.warehouse, (n) => n.endsWith('.yaml') || n.endsWith('.json'))) {
    counts.warehouse++;
    const data = readData(file);

    // The warehouse holds more than budget records now. Dispatching on the path
    // rather than validating everything as a budget keeps an ADM series from
    // being reported as a budget missing every field a budget has.
    const relative = rel(file);
    if (relative.startsWith('warehouse/aoe-adm/')) {
      if (relative.endsWith('/gaps.yaml')) continue;
      findings.push(...schemaFindings('adm', data, file));
      findings.push(...checkRegistryRefs(data, file, registry));
      continue;
    }

    if (relative.startsWith('warehouse/census/')) {
      findings.push(...schemaFindings('census-town', data, file));
      findings.push(...checkRegistryRefs(data, file, registry));
      findings.push(...checkLandAreaOnly(data, file));
      continue;
    }

    if (relative.startsWith('warehouse/small-sparse/')) {
      // gaps.yaml describes what the layer needs and does not have. It is not a
      // record of a school, so validating it as one would report every field a
      // school record has as missing from a file that never claimed to be one.
      if (relative.endsWith('/gaps.yaml')) continue;
      findings.push(...schemaFindings('small-sparse', data, file));
      findings.push(...checkRegistryRefs(data, file, registry));
      continue;
    }

    const record = data as BudgetRecord;
    const schemaProblems = schemaFindings('budget', record, file);
    findings.push(...schemaProblems);

    // Cross-file rules assume a well-formed record; running them on a
    // malformed one produces noise that buries the real error.
    if (schemaProblems.length > 0) continue;

    findings.push(...checkRegistryRefs(record, file, registry));
    findings.push(...checkNullAccounting(record, file));
    findings.push(...checkProvenance(record, file, { verifyHashes }));
    findings.push(
      ...checkAdmCrossCheck(
        record,
        aoeBandsFor(record.entity, record.fiscal_year, admPublication, registry),
        file,
      ),
    );

    const expected = `fy${record.fiscal_year}`;
    if (!basename(file).startsWith(expected)) {
      findings.push({
        severity: 'warning',
        file,
        rule: 'file-naming',
        message: `record is for ${expected} but the filename does not start with it.`,
      });
    }
  }

  // --- report -------------------------------------------------------------
  console.log(
    `Checked ${counts.registry} registry file(s), ${counts.groupings} grouping file(s), ` +
      `${counts.parameters} parameter file(s), ${counts.collectors} collector config(s), ` +
      `${counts.provenance} provenance file(s), ` +
      `${counts.derived} derived file(s), ${counts.warehouse} warehouse record(s).`,
  );
  if (!verifyHashes) console.log('Hash verification skipped (--no-hashes).');

  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const f of warnings) console.log(formatFinding(f));
  }

  if (errors.length > 0) {
    console.log(`\n${errors.length} error(s):`);
    for (const f of errors) console.log(formatFinding(f));
  }

  const { errors: e, warnings: w } = summarize(findings);
  console.log(`\n${e} error(s), ${w} warning(s).`);
  return e > 0 ? 1 : 0;
}

// Guarded so a test can import `correctionsFindings` above without running
// the whole validator against the live repo and calling process.exit out from
// under the test runner.
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
