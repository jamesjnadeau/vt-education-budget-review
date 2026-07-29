#!/usr/bin/env node
/**
 * Assisted extraction.
 *
 *   npm run extract -- --entity su/x --fy 2027 --init    scaffold a mapping file
 *   npm run extract -- --entity su/x --fy 2027           emit a warehouse draft
 *
 * Extraction from a budget PDF is assisted, not automated, and this tool is
 * built around admitting that. It does not read PDFs. What it does is turn a
 * mapping file -- a human's record of where each figure sits in a specific
 * document -- into a schema-conformant draft, and refuse to proceed when the
 * mapping leaves the personnel block unaccounted for.
 *
 * That refusal is the point. A null in the warehouse has to mean "the district
 * did not publish this", never "we did not look", and the only way to
 * guarantee that is to make "we did not look" unrepresentable at the point of
 * extraction.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { PATHS, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';
import { validateAgainst } from '../validate/schemas.ts';

interface Declaration {
  status: 'stated' | 'not_published';
  location?: string | null;
  note?: string | null;
}

interface FieldMapping {
  source: string | null;
  composed_of?: string[];
  not_published?: boolean;
  note?: string | null;
}

interface Mapping {
  schema_version: '1.0';
  entity: string;
  fiscal_year: number;
  artifact: string;
  document_notes: string | null;
  fields: Record<string, FieldMapping>;
  personnel_declaration: {
    salaries: Declaration;
    benefits_health: Declaration;
    benefits_other: Declaration;
    fte: Declaration;
    declared_by: string;
    declared_date: string;
  };
}

const MONEY_FIELDS = [
  'revenues.education_fund',
  'revenues.local',
  'revenues.federal',
  'revenues.other',
  'expenditures.instruction',
  'expenditures.special_education',
  'expenditures.administration_district',
  'expenditures.administration_school',
  'expenditures.operations_maintenance',
  'expenditures.transportation',
  'expenditures.debt_service',
  'expenditures.other',
  'personnel.total_staff_costs',
  'personnel.salaries',
  'personnel.benefits_health',
  'personnel.benefits_other',
  'personnel.fte.teachers',
  'personnel.fte.support_staff',
  'personnel.fte.administrators',
  'personnel.fte.total',
  'enrollment.adm',
  'per_pupil.as_stated',
];

function arg(name: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] ?? null) : null;
}

function slugDir(slug: string): string {
  return slug.replace('/', '-');
}

function mappingPath(slug: string, fy: number): string {
  return join(PATHS.collectors, slugDir(slug), 'mappings', `fy${fy}.yaml`);
}

function warehousePath(slug: string, fy: number): string {
  return join(PATHS.warehouse, slugDir(slug), `fy${fy}.yaml`);
}

function initMapping(slug: string, fy: number): number {
  const path = mappingPath(slug, fy);
  if (existsSync(path)) {
    console.error(`${rel(path)} already exists.`);
    return 1;
  }

  const fields: Record<string, FieldMapping> = {};
  for (const field of MONEY_FIELDS) {
    fields[field] = { source: null, composed_of: [], not_published: false, note: null };
  }

  const mapping: Mapping = {
    schema_version: '1.0',
    entity: slug,
    fiscal_year: fy,
    artifact: 'REPLACE-WITH-FILENAME.pdf',
    document_notes: null,
    fields,
    personnel_declaration: {
      // Left deliberately invalid. Filling these with a plausible default is
      // exactly the failure the declaration exists to prevent, so the file
      // does not validate until a person has actually opened the document.
      salaries: { status: 'not_published', location: null, note: 'REPLACE: has this been checked?' },
      benefits_health: { status: 'not_published', location: null, note: 'REPLACE: has this been checked?' },
      benefits_other: { status: 'not_published', location: null, note: 'REPLACE: has this been checked?' },
      fte: { status: 'not_published', location: null, note: 'REPLACE: has this been checked?' },
      declared_by: 'REPLACE-WITH-YOUR-NAME',
      declared_date: new Date().toISOString().slice(0, 10),
    },
  };

  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(
    path,
    `# Extraction mapping for ${slug}, FY${fy}.\n` +
      `#\n` +
      `# Record WHERE each figure is stated in the document -- page and the line-item\n` +
      `# label as printed. For a rollup assembled from several lines, list them in\n` +
      `# composed_of so the rollup can be re-derived and checked later.\n` +
      `#\n` +
      `# Where the document does not state a figure, set not_published: true rather\n` +
      `# than leaving it blank. A blank and a confirmed absence are different facts.\n` +
      `#\n` +
      `# personnel_declaration is mandatory and starts deliberately unfilled. Every\n` +
      `# entry must say either where the document states salaries / health insurance /\n` +
      `# other benefits / FTEs, or that it does not state them -- confirmed by a person\n` +
      `# who opened it. Merger arguments are staffing arguments, so these four fields\n` +
      `# carry more weight than any other part of the record.\n` +
      `\n` +
      stringifyYaml(mapping, { lineWidth: 88 }),
    'utf8',
  );

  console.log(`Created ${rel(path)}`);
  console.log('Fill it in against the document, then run extract again without --init.');
  return 0;
}

function checkPersonnelDeclaration(mapping: Mapping): string[] {
  const problems: string[] = [];
  const decl = mapping.personnel_declaration;

  if (!decl) {
    return ['mapping has no personnel_declaration block.'];
  }
  if (decl.declared_by.startsWith('REPLACE')) {
    problems.push('personnel_declaration.declared_by is still the placeholder.');
  }

  for (const key of ['salaries', 'benefits_health', 'benefits_other', 'fte'] as const) {
    const entry = decl[key];
    if (!entry) {
      problems.push(`personnel_declaration.${key} is missing.`);
      continue;
    }
    if (entry.note?.startsWith('REPLACE')) {
      problems.push(
        `personnel_declaration.${key} still carries the scaffold placeholder, so it has not been ` +
          `checked against the document. Either give a location, or confirm the document does ` +
          `not publish it and clear the note.`,
      );
    }
    if (entry.status === 'stated' && !entry.location) {
      problems.push(`personnel_declaration.${key} is marked stated but has no location.`);
    }
  }
  return problems;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let node = target;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
    node = node[part] as Record<string, unknown>;
  }
  node[parts[parts.length - 1] as string] = value;
}

function extract(slug: string, fy: number): number {
  const path = mappingPath(slug, fy);
  if (!existsSync(path)) {
    console.error(`No mapping at ${rel(path)}. Create one with --init.`);
    return 1;
  }

  const mapping = parseYaml(readFileSync(path, 'utf8')) as Mapping;

  const schemaErrors = validateAgainst('mapping', mapping);
  if (schemaErrors.length > 0) {
    console.error(`${rel(path)} does not validate:`);
    for (const e of schemaErrors) console.error(`  ${e.path} ${e.message}`);
    return 1;
  }

  const problems = checkPersonnelDeclaration(mapping);
  if (problems.length > 0) {
    console.error(`\nRefusing to extract. The personnel declaration is incomplete:\n`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      `\nThis check exists so that a null in the warehouse always means "the district did not\n` +
        `publish it" and never "we did not look". Open the document and record what is there.\n`,
    );
    return 1;
  }

  const today = new Date().toISOString().slice(0, 10);
  const record: Record<string, unknown> = {
    schema_version: '1.0',
    entity: mapping.entity,
    fiscal_year: mapping.fiscal_year,
    status: 'proposed',
    source: `intake/${slugDir(slug)}/fy${fy}/${mapping.artifact}`,
    source_pages: null,
    mapping: rel(path),
    adopted_date: null,
    extracted_by: mapping.personnel_declaration.declared_by,
    extracted_date: today,
    revenues: {},
    expenditures: {},
    personnel: { fte: {}, as_stated_note: mapping.document_notes },
    enrollment: { adm: null, adm_basis: null, equalized_pupils_stated: null },
    membership_note: null,
    per_pupil: { as_stated: null, as_stated_basis: null },
    tax: { towns: [] },
    not_published: [] as unknown[],
    lines_flagged: [] as unknown[],
  };

  const notPublished: Array<Record<string, unknown>> = [];

  for (const field of MONEY_FIELDS) {
    const entry = mapping.fields[field];
    setPath(record, field, null);
    if (entry?.not_published) {
      notPublished.push({
        path: field,
        confirmed_by: mapping.personnel_declaration.declared_by,
        confirmed_date: mapping.personnel_declaration.declared_date,
        note: entry.note ?? null,
      });
    }
  }

  // The personnel declaration is authoritative for its four fields, so its
  // "not published" answers become not_published entries directly rather than
  // needing to be restated in `fields`.
  const decl = mapping.personnel_declaration;
  const declMap: Array<[string, Declaration]> = [
    ['personnel.salaries', decl.salaries],
    ['personnel.benefits_health', decl.benefits_health],
    ['personnel.benefits_other', decl.benefits_other],
  ];
  for (const [fieldPath, entry] of declMap) {
    if (entry.status === 'not_published' && !notPublished.some((n) => n['path'] === fieldPath)) {
      notPublished.push({
        path: fieldPath,
        confirmed_by: decl.declared_by,
        confirmed_date: decl.declared_date,
        note: entry.note ?? 'declared not published in the extraction mapping',
      });
    }
  }
  if (decl.fte.status === 'not_published') {
    for (const sub of ['teachers', 'support_staff', 'administrators', 'total']) {
      const fieldPath = `personnel.fte.${sub}`;
      if (!notPublished.some((n) => n['path'] === fieldPath)) {
        notPublished.push({
          path: fieldPath,
          confirmed_by: decl.declared_by,
          confirmed_date: decl.declared_date,
          note: decl.fte.note ?? 'declared not published in the extraction mapping',
        });
      }
    }
  }

  record['not_published'] = notPublished;

  const out = warehousePath(slug, fy);
  if (existsSync(out)) {
    console.error(`${rel(out)} already exists. Refusing to overwrite an extracted record.`);
    return 1;
  }

  mkdirSync(join(out, '..'), { recursive: true });
  writeFileSync(
    out,
    `# Extraction draft for ${slug}, FY${fy}.\n` +
      `#\n` +
      `# Generated from ${rel(path)}. Every figure is null: this tool records WHERE each\n` +
      `# number is, not what it is. Read them off the document and fill them in, then run\n` +
      `# npm run validate.\n` +
      `#\n` +
      `# Validation will reject any remaining null that is not accounted for in\n` +
      `# not_published or lines_flagged, so an unfinished record cannot pass as a\n` +
      `# finished one.\n` +
      `\n` +
      stringifyYaml(record, { lineWidth: 88 }),
    'utf8',
  );

  console.log(`Wrote ${rel(out)}`);
  console.log(`  ${notPublished.length} field(s) recorded as not published by the source document.`);
  console.log(`  ${MONEY_FIELDS.length - notPublished.length} field(s) awaiting values from the document.`);
  console.log(`\nNext: fill in the figures, then \`npm run validate\`.`);
  return 0;
}

function main(): number {
  const entity = arg('entity');
  const fyRaw = arg('fy');

  if (!entity || !fyRaw) {
    console.error('Usage: npm run extract -- --entity su/<slug> --fy <year> [--init]');
    return 1;
  }

  const fy = Number(fyRaw);
  if (!Number.isInteger(fy)) {
    console.error(`--fy must be a year, got "${fyRaw}".`);
    return 1;
  }

  const registry = readRegistry();
  if (!registry.has(entity)) {
    console.error(`"${entity}" is not a known registry entity.`);
    return 1;
  }

  return process.argv.includes('--init') ? initMapping(entity, fy) : extract(entity, fy);
}

process.exit(main());
