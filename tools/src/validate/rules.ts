/**
 * Cross-file validation rules.
 *
 * Schema validation catches malformed records. These rules catch the things
 * that make a well-formed record untrustworthy, and they are what stands in
 * for an admin login: nothing reaches `main`, and therefore nothing reaches
 * the site, without passing them.
 *
 * The rules are graded. An `error` blocks the merge. A `warning` is surfaced
 * loudly and does not -- used specifically where the plan says a discrepancy is
 * itself analytically interesting and must not be silently reconciled. A
 * district's printed per-pupil figure disagreeing with our recomputation is a
 * finding to publish, not a bug to fix, so it warns.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PATHS, rel } from '../paths.ts';
import type { RegistryEntity } from '../registry/types.ts';

export type Severity = 'error' | 'warning';

export interface Finding {
  readonly severity: Severity;
  readonly file: string;
  readonly rule: string;
  readonly message: string;
}

export interface BudgetRecord {
  readonly schema_version: string;
  readonly entity: string;
  readonly fiscal_year: number;
  readonly status: string;
  readonly source: string;
  readonly not_published?: ReadonlyArray<{ path: string; [key: string]: unknown }>;
  readonly lines_flagged?: ReadonlyArray<{ path: string; [key: string]: unknown }>;
  readonly [key: string]: unknown;
}

// --------------------------------------------------------------------------
// Null accounting
// --------------------------------------------------------------------------

/**
 * Paths whose null must be explained. Descriptive and optional fields are not
 * listed -- a missing note is not a missing figure.
 */
const ACCOUNTABLE = [
  /^revenues\.(education_fund|local|federal|other)$/,
  /^expenditures\.(instruction|special_education|administration_district|administration_school|operations_maintenance|transportation|debt_service|other)$/,
  /^personnel\.(total_staff_costs|salaries|benefits_health|benefits_other)$/,
  /^personnel\.fte\.(teachers|support_staff|administrators|total)$/,
  /^enrollment\.adm$/,
  /^per_pupil\.as_stated$/,
  /^tax\.towns\.\d+\.(homestead_rate_stated|cla)$/,
];

function isAccountable(path: string): boolean {
  return ACCOUNTABLE.some((p) => p.test(path));
}

export function collectNullPaths(value: unknown, prefix = ''): string[] {
  const out: string[] = [];
  if (value === null) {
    if (prefix) out.push(prefix);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...collectNullPaths(v, prefix ? `${prefix}.${i}` : String(i))));
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.push(...collectNullPaths(v, prefix ? `${prefix}.${k}` : k));
    }
  }
  return out;
}

/**
 * Every unexplained null is an error.
 *
 * This is the rule that makes a null in the warehouse mean "the district did
 * not publish it" rather than "we did not look". Without it the two are
 * indistinguishable, and the entire personnel block -- which the plan makes a
 * first-class extraction target precisely because merger claims are staffing
 * claims -- would quietly fill with nulls that mean nothing.
 */
export function checkNullAccounting(record: BudgetRecord, file: string): Finding[] {
  const explained = new Set<string>([
    ...(record.not_published ?? []).map((n) => n.path),
    ...(record.lines_flagged ?? []).map((n) => n.path),
  ]);

  const findings: Finding[] = [];
  for (const path of collectNullPaths(record)) {
    if (!isAccountable(path)) continue;
    // tax.towns.0.cla is explained by an entry for either the exact path or
    // the whole block, since a document that publishes no town table at all
    // should not need one entry per town.
    const generalized = path.replace(/\.\d+\./, '.');
    if (explained.has(path) || explained.has(generalized)) continue;

    findings.push({
      severity: 'error',
      file,
      rule: 'null-accounting',
      message:
        `${path} is null but is not listed in not_published or lines_flagged. ` +
        `Either record that the source document does not publish it -- with who ` +
        `confirmed that and when -- or supply the value. An unexplained null cannot ` +
        `be distinguished from a field nobody checked.`,
    });
  }
  return findings;
}

// --------------------------------------------------------------------------
// Provenance
// --------------------------------------------------------------------------

interface ProvenanceArtifact {
  readonly file: string;
  readonly sha256: string;
  readonly source_url?: string | null;
  readonly retrieval_method?: string;
  readonly note?: string | null;
}

interface ProvenanceDoc {
  readonly entity: string;
  readonly fiscal_year: number;
  readonly artifacts: readonly ProvenanceArtifact[];
}

export function sha256Of(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Checks that a warehouse record's source artifact exists, is registered in a
 * provenance file, and has not been altered since it was retrieved.
 *
 * Raw intake is sacred: artifacts are stored exactly as released and never
 * edited. A hash mismatch is therefore always an error, never a prompt to
 * update the hash.
 */
export function checkProvenance(
  record: BudgetRecord,
  file: string,
  options: { readonly verifyHashes: boolean },
): Finding[] {
  const findings: Finding[] = [];
  const sourcePath = join(PATHS.intake, '..', record.source);

  if (!existsSync(sourcePath)) {
    findings.push({
      severity: 'error',
      file,
      rule: 'source-exists',
      message: `source "${record.source}" does not exist in the repository.`,
    });
    return findings;
  }

  const dir = sourcePath.slice(0, sourcePath.lastIndexOf('/'));
  const provenancePath = join(dir, 'provenance.yaml');
  if (!existsSync(provenancePath)) {
    findings.push({
      severity: 'error',
      file,
      rule: 'provenance-exists',
      message: `no provenance.yaml beside ${record.source}. Every raw artifact carries one.`,
    });
    return findings;
  }

  return findings;
}

export function checkProvenanceDoc(
  doc: ProvenanceDoc,
  file: string,
  dir: string,
  options: { readonly verifyHashes: boolean },
): Finding[] {
  const findings: Finding[] = [];

  for (const artifact of doc.artifacts) {
    const path = join(dir, artifact.file);
    if (!existsSync(path)) {
      findings.push({
        severity: 'error',
        file,
        rule: 'artifact-exists',
        message: `artifact "${artifact.file}" is listed in provenance but is not present.`,
      });
      continue;
    }

    if (options.verifyHashes) {
      const isLfsPointer = readFileSync(path, 'utf8').startsWith('version https://git-lfs');
      if (isLfsPointer) {
        findings.push({
          severity: 'warning',
          file,
          rule: 'hash-verification',
          message:
            `"${artifact.file}" is an unfetched Git LFS pointer, so its hash could not be ` +
            `verified. Run \`git lfs pull\` before treating this check as having passed.`,
        });
        continue;
      }
      const actual = sha256Of(path);
      if (actual !== artifact.sha256) {
        findings.push({
          severity: 'error',
          file,
          rule: 'hash-verification',
          message:
            `"${artifact.file}" hashes to ${actual} but provenance records ${artifact.sha256}. ` +
            `Raw artifacts are never edited -- do not update the hash to match. Work out what ` +
            `changed the file.`,
        });
      }
    }

    if (!artifact.source_url) {
      const method = artifact.retrieval_method ?? '';
      if (method !== 'email' && method !== 'in_person' && method !== 'foia') {
        findings.push({
          severity: 'error',
          file,
          rule: 'provenance-completeness',
          message: `"${artifact.file}" has no source_url and retrieval_method is "${method}", which requires one.`,
        });
      } else if (!artifact.note) {
        findings.push({
          severity: 'error',
          file,
          rule: 'provenance-completeness',
          message: `"${artifact.file}" was obtained by ${method} and has no source_url, so it needs a note explaining where it came from.`,
        });
      }
    }
  }

  return findings;
}

// --------------------------------------------------------------------------
// Registry references
// --------------------------------------------------------------------------

const ENTITY_REF = /^(su|sd|ud|school|town|academy|techcenter|independent|state)\/[a-z0-9]+(-[a-z0-9]+)*$/;

/** Every slug mentioned anywhere must resolve to a registry entity. */
export function checkRegistryRefs(
  value: unknown,
  file: string,
  registry: ReadonlyMap<string, RegistryEntity>,
): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      if (ENTITY_REF.test(v) && !seen.has(v)) {
        seen.add(v);
        if (!registry.has(v)) {
          findings.push({
            severity: 'error',
            file,
            rule: 'registry-reference',
            message: `"${v}" is not a known registry entity. Run \`npm run registry:sync\` or correct the slug.`,
          });
        }
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };

  walk(value);
  return findings;
}

// --------------------------------------------------------------------------
// Recomputation of derived figures
// --------------------------------------------------------------------------

function num(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * Recomputes what the record states it derived, and reports disagreements.
 *
 * These WARN rather than fail. The plan is explicit that a district's printed
 * per-pupil figure disagreeing with a recomputation is analytically
 * interesting and must not be silently fixed -- so the check exists to surface
 * the discrepancy for publication, not to suppress it.
 */
export function checkRecomputation(record: BudgetRecord, file: string): Finding[] {
  const findings: Finding[] = [];

  const expenditures = record['expenditures'] as Record<string, unknown> | undefined;
  const revenues = record['revenues'] as Record<string, unknown> | undefined;

  const sumParts = (block: Record<string, unknown> | undefined, keys: readonly string[]): number | null => {
    if (!block) return null;
    let total = 0;
    for (const k of keys) {
      const v = num(block[k]);
      if (v === null) return null;
      total += v;
    }
    return total;
  };

  const expenditureTotal = sumParts(expenditures, [
    'instruction',
    'special_education',
    'administration_district',
    'administration_school',
    'operations_maintenance',
    'transportation',
    'debt_service',
    'other',
  ]);
  const statedExpenditure = num(expenditures?.['total_stated']);
  if (expenditureTotal !== null && statedExpenditure !== null) {
    const diff = Math.abs(expenditureTotal - statedExpenditure);
    if (diff > Math.max(1, statedExpenditure * 0.001)) {
      findings.push({
        severity: 'warning',
        file,
        rule: 'recomputation',
        message:
          `expenditure rollups sum to ${expenditureTotal.toLocaleString()} but the document ` +
          `states ${statedExpenditure.toLocaleString()} (difference ${diff.toLocaleString()}). ` +
          `Both figures are kept. Record why they differ in lines_flagged.`,
      });
    }
  }

  const revenueTotal = sumParts(revenues, ['education_fund', 'local', 'federal', 'other']);
  const statedRevenue = num(revenues?.['total_stated']);
  if (revenueTotal !== null && statedRevenue !== null) {
    const diff = Math.abs(revenueTotal - statedRevenue);
    if (diff > Math.max(1, statedRevenue * 0.001)) {
      findings.push({
        severity: 'warning',
        file,
        rule: 'recomputation',
        message:
          `revenue rollups sum to ${revenueTotal.toLocaleString()} but the document states ` +
          `${statedRevenue.toLocaleString()} (difference ${diff.toLocaleString()}).`,
      });
    }
  }

  // The two blocks describe the same dollars sliced differently, so staff
  // costs exceeding total expenditure means one of them is misread.
  const personnel = record['personnel'] as Record<string, unknown> | undefined;
  const staffCosts = num(personnel?.['total_staff_costs']);
  if (staffCosts !== null && expenditureTotal !== null && staffCosts > expenditureTotal) {
    findings.push({
      severity: 'error',
      file,
      rule: 'personnel-vs-expenditure',
      message:
        `personnel.total_staff_costs (${staffCosts.toLocaleString()}) exceeds total ` +
        `expenditure (${expenditureTotal.toLocaleString()}). These blocks slice the SAME ` +
        `dollars by object and by function -- they are never additive, and staff costs are ` +
        `always a subset. One of the two has been misread.`,
    });
  }

  const salaries = num(personnel?.['salaries']);
  const health = num(personnel?.['benefits_health']);
  const otherBenefits = num(personnel?.['benefits_other']);
  if (staffCosts !== null && salaries !== null && health !== null && otherBenefits !== null) {
    const parts = salaries + health + otherBenefits;
    const diff = Math.abs(parts - staffCosts);
    if (diff > Math.max(1, staffCosts * 0.001)) {
      findings.push({
        severity: 'warning',
        file,
        rule: 'recomputation',
        message:
          `salaries + health + other benefits = ${parts.toLocaleString()}, but ` +
          `total_staff_costs is ${staffCosts.toLocaleString()}.`,
      });
    }
  }

  return findings;
}

export function summarize(findings: readonly Finding[]): { errors: number; warnings: number } {
  return {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
  };
}

export function formatFinding(finding: Finding): string {
  const mark = finding.severity === 'error' ? 'ERROR' : 'warn ';
  return `  ${mark} ${rel(finding.file)} [${finding.rule}]\n        ${finding.message}`;
}
