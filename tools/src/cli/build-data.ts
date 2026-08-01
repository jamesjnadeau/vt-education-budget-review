#!/usr/bin/env node
/**
 * Emits the static JSON the site is built from and the modeling tool fetches.
 *
 *   npm run build:data
 *
 * Two destinations, for two different consumers:
 *
 *   site/src/generated/   imported at build time by Astro pages
 *   site/public/data/     fetched at run time by the modeling island
 *
 * Both are gitignored. The git history should only ever show source data
 * changing; everything here is reproducible from /registry, /warehouse and
 * /model. At Vermont's scale the whole dataset is a few megabytes, so the
 * per-SU split exists to keep the island's first fetch small, not because
 * there is a performance problem to solve.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { parseParameterSet, unverifiedParameters } from '@vt-budget/model';
import { buildAdmPublication } from '../aoe/adm/publish.ts';
import { buildCoverage } from '../coverage.ts';
import { walkFiles } from '../fs-walk.ts';
import { PATHS, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';
import {
  buildSmallSparse,
  SMALL_SPARSE_PARAMETER_FILE,
  SMALL_SPARSE_PARAMETER_REF,
} from '../small-sparse/build.ts';
import type { RegistryEntity } from '../registry/types.ts';

interface BudgetRecord {
  entity: string;
  fiscal_year: number;
  status: string;
  [key: string]: unknown;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(data), 'utf8');
}

function readBudgets(): BudgetRecord[] {
  return walkFiles(PATHS.warehouse, (n) => n.endsWith('.yaml') || n.endsWith('.json'))
    // The warehouse holds more than budgets now: the AOE ADM series, which is
    // the state's voice about pupils, and the Census land-area record. Reading
    // either as a budget would put an object with no revenues or expenditures
    // into every per-SU page's budget list.
    .filter((file) => {
      const path = rel(file);
      return (
        !path.startsWith('warehouse/aoe-adm/') &&
        !path.startsWith('warehouse/census/') &&
        !path.startsWith('warehouse/small-sparse/')
      );
    })
    .map((file) => {
    const text = readFileSync(file, 'utf8');
    const record = (file.endsWith('.json') ? JSON.parse(text) : parseYaml(text)) as BudgetRecord;
    return { ...record, _file: rel(file) };
  });
}

function main(): number {
  rmSync(PATHS.siteGenerated, { recursive: true, force: true });
  rmSync(PATHS.siteData, { recursive: true, force: true });
  mkdirSync(PATHS.siteGenerated, { recursive: true });
  mkdirSync(PATHS.siteData, { recursive: true });

  const registry = readRegistry();
  const budgets = readBudgets();
  const today = new Date();

  // --- registry, grouped for the site's page generators --------------------
  const byType = new Map<string, RegistryEntity[]>();
  for (const entity of registry.values()) {
    const list = byType.get(entity.type) ?? [];
    list.push(entity);
    byType.set(entity.type, list);
  }
  for (const list of byType.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  // Counts describe the active universe. A closed school or SU (one whose
  // effective_to has passed) still keeps its history page, but it is not
  // counted here — otherwise the headline tallies claim more exists than does.
  const todayIso = today.toISOString().slice(0, 10);
  const isActive = (e: RegistryEntity) => !e.effective_to || e.effective_to >= todayIso;

  writeJson(join(PATHS.siteGenerated, 'registry.json'), {
    generated: today.toISOString(),
    counts: Object.fromEntries([...byType].map(([k, v]) => [k, v.filter(isActive).length])),
    entities: [...registry.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
  });

  // --- parameters ----------------------------------------------------------
  const parameterFiles = walkFiles(PATHS.parameters, (n) => n.endsWith('.yaml'));
  const parameterSets = parameterFiles.map((file) => {
    const set = parseParameterSet(parseYaml(readFileSync(file, 'utf8')));
    return {
      file: rel(file),
      fiscal_year: set.fiscal_year,
      status: set.status,
      note: set.note,
      unverified_count: unverifiedParameters(set).length,
      parameters: [...set.parameters.values()],
    };
  });
  writeJson(join(PATHS.siteGenerated, 'parameters.json'), parameterSets);

  // --- groupings -----------------------------------------------------------
  let groupings: unknown = { status: 'draft', groupings: [] };
  try {
    groupings = parseYaml(readFileSync(PATHS.groupings, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  writeJson(join(PATHS.siteGenerated, 'groupings.json'), groupings);

  // --- coverage ------------------------------------------------------------
  const coverage = buildCoverage(registry, { today });
  writeJson(join(PATHS.siteGenerated, 'coverage.json'), coverage);

  // --- AOE average daily membership ---------------------------------------
  // The district rollup is computed here, not stored: it is derived from the
  // warehouse and the registry, and nothing derived is committed.
  const admDir = join(PATHS.warehouse, 'aoe-adm');
  const admRecords = walkFiles(admDir, (n) => /^adm\d{2}\.yaml$/.test(n)).map(
    (file) => parseYaml(readFileSync(file, 'utf8')) as unknown,
  );
  if (admRecords.length > 0) {
    writeJson(
      join(PATHS.siteGenerated, 'adm.json'),
      buildAdmPublication(admRecords, registry, today.toISOString()),
    );
  }

  let smallSparseCounts: Record<string, number> | null = null;

  // --- small / sparse candidate table --------------------------------------
  // Computed here rather than committed: it is derived from the registry, the
  // census record and the parameter file, and nothing derived is committed.
  if (existsSync(SMALL_SPARSE_PARAMETER_FILE)) {
    const smallSparseSet = parseParameterSet(
      parseYaml(readFileSync(SMALL_SPARSE_PARAMETER_FILE, 'utf8')),
    );
    const smallSparse = buildSmallSparse(registry, smallSparseSet, {
      parameterSetRef: SMALL_SPARSE_PARAMETER_REF,
      generated: today.toISOString(),
      // Neither has a default in the statute as read, so the build states which
      // frame it published under and the page repeats it. A default chosen here
      // and forgotten downstream is how an unread question becomes an answer.
      enrollmentBasis: 'two_year_average',
      populationSeries: 'decennial_2020',
    });
    writeJson(join(PATHS.siteGenerated, 'small-sparse.json'), smallSparse);
    smallSparseCounts = smallSparse.counts;
  }

  // --- per-SU data, and the compact index the modeling island loads first ---
  const sus = (byType.get('su') ?? []).filter((e) => !e.effective_to);
  const districts = byType.get('ud') ?? [];
  // Reporting buckets are excluded from every derived count and listing. A
  // town record named UNKNOWN is how AOE records residency for pupils whose
  // town is not established: no membership is awarded to it, so counting it as
  // a town an SU serves would overstate every SU it touches. It stays in
  // registry.json, because other records reference it -- it just is not a place.
  const towns = (byType.get('town') ?? []).filter((t) => !t.reporting_only);
  const schools = byType.get('school') ?? [];

  const budgetsByEntity = new Map<string, BudgetRecord[]>();
  for (const budget of budgets) {
    const list = budgetsByEntity.get(budget.entity) ?? [];
    list.push(budget);
    budgetsByEntity.set(budget.entity, list);
  }

  for (const su of sus) {
    const suDistricts = districts.filter((d) => d.supervisory_union === su.slug);
    const suSchools = schools.filter((s) => s.supervisory_union === su.slug);
    const suTowns = towns.filter((t) => t.supervisory_union === su.slug);

    writeJson(join(PATHS.siteData, 'su', `${su.slug.split('/')[1]}.json`), {
      entity: su,
      districts: suDistricts,
      schools: suSchools,
      towns: suTowns,
      budgets: [
        ...(budgetsByEntity.get(su.slug) ?? []),
        ...suDistricts.flatMap((d) => budgetsByEntity.get(d.slug) ?? []),
      ].sort((a, b) => b.fiscal_year - a.fiscal_year),
    });
  }

  writeJson(join(PATHS.siteData, 'index.json'), {
    generated: today.toISOString(),
    supervisory_unions: sus.map((s) => ({
      slug: s.slug,
      name: s.name,
      districts: districts.filter((d) => d.supervisory_union === s.slug).length,
      towns: towns.filter((t) => t.supervisory_union === s.slug).length,
    })),
    towns: towns.map((t) => ({
      slug: t.slug,
      name: t.name,
      supervisory_union: t.supervisory_union,
      operated_by: t.operated_by,
    })),
    budget_count: budgets.length,
    // Stated up front so a consumer of this file cannot mistake an empty
    // warehouse for a warehouse of zeros.
    warehouse_is_empty: budgets.length === 0,
  });

  console.log(`Wrote site data:`);
  console.log(`  ${registry.size} registry entities`);
  console.log(`  ${sus.length} active supervisory union files`);
  console.log(`  ${budgets.length} budget record(s)`);
  console.log(`  coverage: ${JSON.stringify(coverage.totals)}`);
  console.log(`  ${parameterSets.length} parameter set(s), ${parameterSets.reduce((n, p) => n + p.unverified_count, 0)} unverified parameter(s)`);
  if (smallSparseCounts) {
    console.log(
      `  small/sparse: ${smallSparseCounts['schools']} schools, ` +
        `${smallSparseCounts['with_municipality']} located in a town, ` +
        `${smallSparseCounts['with_land_area']} with land area, ` +
        `${smallSparseCounts['with_population']} with population, ` +
        `${smallSparseCounts['screens_resolved']} screens resolved`,
    );
  }

  return 0;
}

process.exit(main());
