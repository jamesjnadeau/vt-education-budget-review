/**
 * Turning a parsed normalize-form body into a budget record, or the list of
 * specific reasons it cannot be accepted.
 *
 * This is the budget schema enforced in code at submission time, so a problem
 * reaches the extractor as a comment on their own issue rather than a red check
 * on a bot's PR. Every accountable figure must be a number or the `n/p`
 * sentinel; an `n/p` becomes a `not_published` entry the extractor is recorded
 * as having confirmed, on the day they submitted. Two extraction-provenance
 * fields are computed rather than asked: `extracted_by` is the author's handle,
 * `extracted_date` the submission date.
 */

import { parseIssueForm } from '../intake/parse.ts';
import { FIGURE_FIELDS, STATUSES, parseFigure, setPath } from './fields.ts';
import { parseTaxTable } from './tax.ts';

const SOURCE_PATTERN = /^intake\/[a-z0-9-]+\/fy[0-9]{4}\/[^\/]+$/;
const FIRST_FY = 2015;
const LAST_FY = 2100;

export interface NormalizeInput {
  readonly body: string;
  readonly authorLogin: string;
  /** Submission date, ISO. Injected so the record is deterministic under test. */
  readonly today: string;
  readonly knownSlugs: ReadonlySet<string>;
  /** Whether a repo-relative path exists. Injected to keep this pure. */
  readonly sourceExists: (path: string) => boolean;
}

export interface NotPublished {
  readonly path: string;
  readonly confirmed_by: string;
  readonly confirmed_date: string;
}

export type NormalizeResult =
  | { readonly ok: true; readonly record: Record<string, unknown>; readonly notPublished: readonly string[] }
  | { readonly ok: false; readonly errors: readonly string[] };

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function parseLinesFlagged(
  text: string,
): { ok: true; lines: Array<{ path: string; issue: string; resolution: string }> } | { ok: false; errors: string[] } {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, lines: [] };
  const errors: string[] = [];
  const lines: Array<{ path: string; issue: string; resolution: string }> = [];
  for (const raw of trimmed.split('\n')) {
    if (raw.trim() === '') continue;
    const idx = raw.indexOf('::');
    const path = idx === -1 ? '' : raw.slice(0, idx).trim();
    const issue = idx === -1 ? '' : raw.slice(idx + 2).trim();
    if (!path || !issue) {
      errors.push(`"${raw.trim()}" is not "path :: issue"`);
      continue;
    }
    lines.push({ path, issue, resolution: 'pending' });
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, lines };
}

export function buildRecord(inputData: NormalizeInput): NormalizeResult {
  const form = parseIssueForm(inputData.body);
  const errors: string[] = [];
  const author = `@${inputData.authorLogin}`;
  const get = (label: string): string | null => form.get(label) ?? null;

  const record: Record<string, unknown> = {
    schema_version: '1.0',
    extracted_by: author,
    extracted_date: inputData.today,
  };
  const notPublished: NotPublished[] = [];

  // --- identity -----------------------------------------------------------
  const entity = get('entity');
  if (!entity) errors.push('entity is required.');
  else if (!inputData.knownSlugs.has(entity)) {
    errors.push(`entity "${entity}" is not a known registry entity.`);
  } else record['entity'] = entity;

  const fyRaw = get('fiscal_year');
  if (!fyRaw || !/^\d{4}$/.test(fyRaw)) {
    errors.push('fiscal_year must be a four-digit year.');
  } else {
    const fy = Number(fyRaw);
    if (fy < FIRST_FY || fy > LAST_FY) errors.push(`fiscal_year ${fy} is outside ${FIRST_FY}-${LAST_FY}.`);
    else record['fiscal_year'] = fy;
  }

  const status = get('status');
  if (!status) errors.push('status is required.');
  else if (!(STATUSES as readonly string[]).includes(status)) {
    errors.push(`status "${status}" is not one of ${STATUSES.join(', ')}.`);
  } else record['status'] = status;

  const source = get('source');
  if (!source) errors.push('source is required.');
  else if (!SOURCE_PATTERN.test(source)) {
    errors.push(`source "${source}" is not an intake path (intake/<slug>/fy<year>/<file>).`);
  } else if (!inputData.sourceExists(source)) {
    errors.push(`source "${source}" does not exist in the repository. Land the raw artifact through intake first.`);
  } else record['source'] = source;

  const sourcePages = get('source pages') ?? get('source_pages');
  if (sourcePages) record['source_pages'] = sourcePages;
  const adopted = get('adopted_date');
  if (adopted) {
    if (!isIsoDate(adopted)) errors.push(`adopted_date "${adopted}" is not an ISO date.`);
    else record['adopted_date'] = adopted;
  }

  // --- figures ------------------------------------------------------------
  for (const field of FIGURE_FIELDS) {
    const raw = get(field.path);

    if (field.kind === 'text') {
      if (raw) setPath(record, field.path, raw);
      continue;
    }

    if (!field.accountable) {
      // Optional numeric: a blank is a legitimate null (emitted); a value is
      // parsed, and an n/p on an optional field simply means null.
      if (raw === null) {
        setPath(record, field.path, null);
        continue;
      }
      const parsed = parseFigure(raw);
      if ('error' in parsed) errors.push(`${field.path} ${parsed.error}`);
      else if ('notPublished' in parsed) setPath(record, field.path, null);
      else if ('value' in parsed) setPath(record, field.path, parsed.value);
      continue;
    }

    // Accountable: a number, or n/p (recorded as not_published), never blank.
    const parsed = parseFigure(raw ?? '');
    if ('error' in parsed) {
      errors.push(`${field.path} ${parsed.error}`);
    } else if ('notPublished' in parsed) {
      setPath(record, field.path, null);
      notPublished.push({ path: field.path, confirmed_by: author, confirmed_date: inputData.today });
    } else {
      setPath(record, field.path, parsed.value);
    }
  }

  // --- tax ----------------------------------------------------------------
  const tax = parseTaxTable(get('tax.towns') ?? '', inputData.knownSlugs);
  if (!tax.ok) errors.push(...tax.errors);
  else record['tax'] = { towns: tax.towns };

  // --- notes (free text, optional, never accountable) ---------------------
  const notes = get('notes');
  record['notes'] = notes && notes.trim() !== '' ? notes.trim() : null;

  // --- lines_flagged ------------------------------------------------------
  const flagged = parseLinesFlagged(get('lines_flagged') ?? '');
  if (!flagged.ok) errors.push(...flagged.errors);
  else record['lines_flagged'] = flagged.lines;

  record['not_published'] = notPublished;

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, record, notPublished: notPublished.map((n) => n.path) };
}
