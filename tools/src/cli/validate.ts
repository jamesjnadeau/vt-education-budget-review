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

import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { parseParameterSet, unverifiedParameters } from '@vt-budget/model';
import { walkFiles } from '../fs-walk.ts';
import { PATHS, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';
import {
  checkNullAccounting,
  checkPlaceholderEntities,
  checkProvenance,
  checkProvenanceDoc,
  checkRecomputation,
  checkRegistryRefs,
  formatFinding,
  summarize,
  type BudgetRecord,
  type Finding,
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

function main(): number {
  const verifyHashes = !process.argv.includes('--no-hashes');
  const findings: Finding[] = [];
  const counts = {
    registry: 0,
    warehouse: 0,
    provenance: 0,
    collectors: 0,
    mappings: 0,
    parameters: 0,
    groupings: 0,
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

  // --- extraction mappings ------------------------------------------------
  for (const file of walkFiles(PATHS.collectors, (n) => /^fy\d{4}\.yaml$/.test(n))) {
    counts.mappings++;
    const data = readData(file);
    findings.push(...schemaFindings('mapping', data, file));
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
        ...checkProvenanceDoc(data as never, file, dirname(file), { verifyHashes }),
      );
    }
  }

  // --- warehouse ----------------------------------------------------------
  for (const file of walkFiles(PATHS.warehouse, (n) => n.endsWith('.yaml') || n.endsWith('.json'))) {
    counts.warehouse++;
    const data = readData(file) as BudgetRecord;
    const schemaProblems = schemaFindings('budget', data, file);
    findings.push(...schemaProblems);

    // Cross-file rules assume a well-formed record; running them on a
    // malformed one produces noise that buries the real error.
    if (schemaProblems.length > 0) continue;

    findings.push(...checkRegistryRefs(data, file, registry));
    findings.push(...checkNullAccounting(data, file));
    findings.push(...checkProvenance(data, file, { verifyHashes }));
    findings.push(...checkRecomputation(data, file));

    const expected = `fy${data.fiscal_year}`;
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
      `${counts.mappings} mapping(s), ${counts.provenance} provenance file(s), ${counts.warehouse} warehouse record(s).`,
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

process.exit(main());
