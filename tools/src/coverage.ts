/**
 * The coverage matrix.
 *
 * Computed at build time and published, because transparency about gaps is on
 * brand: a site that shows what it does not have is more credible than one
 * that only shows what it does.
 *
 * Four states, and the distinction between the last two is the important one:
 *
 *   normalized      a schema-conformant record exists in the warehouse
 *   intake_only     the raw artifact is in the repo but nothing is extracted yet
 *   not_published   we checked and the district published no budget document
 *   missing         we have not got it
 *
 * `not_published` renders grey and `missing` renders red because a gap someone
 * checked is a different fact from a gap nobody has looked at. Collapsing them
 * would make the dashboard's headline coverage number a lie in both directions.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { flagIssueUrl, intakeIssueUrl, normalizeIssueUrl, CONFIG } from './config.ts';
import { walkFiles } from './fs-walk.ts';
import { PATHS, rel } from './paths.ts';
import type { RegistryEntity } from './registry/types.ts';

export type CellState = 'normalized' | 'intake_only' | 'not_published' | 'missing';

export interface CoverageCell {
  readonly entity: string;
  readonly entityName: string;
  readonly fiscalYear: number;
  readonly state: CellState;
  readonly warehouseFile: string | null;
  readonly intakeFiles: readonly string[];
  readonly budgetStatus: string | null;
  readonly lastKnownSource: string | null;
  /** Deep link to the prefilled budget-intake issue form, or null once normalized. */
  readonly intakeUrl: string | null;
  /** Deep link to the prefilled budget-normalize form; set only for intake_only cells. */
  readonly normalizeUrl: string | null;
  readonly flagUrl: string | null;
  readonly notPublishedNote: string | null;
}

export interface CoverageReport {
  readonly generated: string;
  readonly fiscalYears: readonly number[];
  readonly entities: ReadonlyArray<{ slug: string; name: string; priority: number | null }>;
  readonly cells: readonly CoverageCell[];
  readonly totals: Readonly<Record<CellState, number>>;
}

interface CollectorConfig {
  entity: string;
  priority: number | null;
  sources: Array<{ url: string; kind: string }>;
  known_not_published?: Array<{ fiscal_year: number; note?: string | null }>;
}

function readCollectors(): Map<string, CollectorConfig> {
  const out = new Map<string, CollectorConfig>();
  for (const file of walkFiles(PATHS.collectors, (n) => n === 'config.yaml')) {
    const config = parseYaml(readFileSync(file, 'utf8')) as CollectorConfig;
    out.set(config.entity, config);
  }
  return out;
}

interface WarehouseEntry {
  readonly file: string;
  readonly status: string;
}

function readWarehouseIndex(): Map<string, WarehouseEntry> {
  const out = new Map<string, WarehouseEntry>();
  for (const file of walkFiles(PATHS.warehouse, (n) => n.endsWith('.yaml') || n.endsWith('.json'))) {
    const text = readFileSync(file, 'utf8');
    const record = (file.endsWith('.json') ? JSON.parse(text) : parseYaml(text)) as {
      entity?: string;
      fiscal_year?: number;
      status?: string;
    };
    if (!record.entity || !record.fiscal_year) continue;
    out.set(`${record.entity}::${record.fiscal_year}`, {
      file: rel(file),
      status: record.status ?? 'unknown',
    });
  }
  return out;
}

function readIntakeIndex(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!existsSync(PATHS.intake)) return out;

  for (const entityDir of readdirSync(PATHS.intake)) {
    const entityPath = join(PATHS.intake, entityDir);
    if (!existsSync(entityPath)) continue;
    for (const fyDir of readdirSync(entityPath)) {
      const match = fyDir.match(/^fy(\d{4})$/);
      if (!match) continue;
      const files = readdirSync(join(entityPath, fyDir)).filter((f) => f !== 'provenance.yaml');
      // Intake directories are named with the slug's slash replaced by a
      // hyphen, since a directory cannot contain one.
      const slug = entityDir.replace('-', '/');
      out.set(`${slug}::${Number(match[1])}`, files);
    }
  }
  return out;
}

export interface CoverageOptions {
  readonly today: Date;
  readonly firstFiscalYear?: number;
}

/**
 * Fiscal years a budget is expected for.
 *
 * Runs one year past the current fiscal year, because a district's FY28 budget
 * is warned and voted during FY27 -- the year that matters most to a resident
 * is the one that has not started yet.
 */
export function expectedFiscalYears(today: Date, firstFiscalYear: number): number[] {
  const month = today.getUTCMonth(); // 0-indexed; Vermont fiscal years end 30 June
  const currentFy = month >= 6 ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
  const years: number[] = [];
  for (let y = firstFiscalYear; y <= currentFy + 1; y++) years.push(y);
  return years;
}

export function buildCoverage(
  registry: ReadonlyMap<string, RegistryEntity>,
  options: CoverageOptions,
): CoverageReport {
  const firstFy = options.firstFiscalYear ?? CONFIG.firstFiscalYear;
  const fiscalYears = expectedFiscalYears(options.today, firstFy);

  const collectors = readCollectors();
  const warehouse = readWarehouseIndex();
  const intake = readIntakeIndex();

  const todayIso = options.today.toISOString().slice(0, 10);

  // Supervisory unions that are active today. A closed SU is not expected to
  // publish a budget, and listing it as a red gap forever would make the
  // dashboard useless.
  const entities = [...registry.values()]
    .filter((e) => e.type === 'su' && (!e.effective_to || e.effective_to >= todayIso))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({ slug: e.slug, name: e.name, priority: collectors.get(e.slug)?.priority ?? null }));

  const cells: CoverageCell[] = [];
  const totals: Record<CellState, number> = {
    normalized: 0,
    intake_only: 0,
    not_published: 0,
    missing: 0,
  };

  for (const entity of entities) {
    const collector = collectors.get(entity.slug);
    const lastKnownSource = collector?.sources?.[0]?.url ?? null;

    for (const fiscalYear of fiscalYears) {
      const key = `${entity.slug}::${fiscalYear}`;
      const warehouseEntry = warehouse.get(key);
      const intakeFiles = intake.get(key) ?? [];
      const confirmedAbsent = collector?.known_not_published?.find((k) => k.fiscal_year === fiscalYear);

      let state: CellState;
      if (warehouseEntry) state = 'normalized';
      else if (intakeFiles.length > 0) state = 'intake_only';
      else if (confirmedAbsent) state = 'not_published';
      else state = 'missing';

      totals[state]++;

      // The artifact to normalize: the first intake file, at the path the intake
      // index reads it from. Only meaningful for an intake_only cell.
      const sourcePath =
        intakeFiles.length > 0
          ? `intake/${entity.slug.replace('/', '-')}/fy${fiscalYear}/${intakeFiles[0]}`
          : null;

      cells.push({
        entity: entity.slug,
        entityName: entity.name,
        fiscalYear,
        state,
        warehouseFile: warehouseEntry?.file ?? null,
        intakeFiles,
        budgetStatus: warehouseEntry?.status ?? null,
        lastKnownSource,
        intakeUrl: state === 'normalized' ? null : intakeIssueUrl(entity.slug, fiscalYear),
        normalizeUrl:
          state === 'intake_only' && sourcePath
            ? normalizeIssueUrl(entity.slug, fiscalYear, sourcePath)
            : null,
        flagUrl: state === 'missing' ? flagIssueUrl(entity.slug, entity.name, fiscalYear, lastKnownSource) : null,
        notPublishedNote: confirmedAbsent?.note ?? null,
      });
    }
  }

  return {
    generated: todayIso,
    fiscalYears,
    entities,
    cells,
    totals,
  };
}
