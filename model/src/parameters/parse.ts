/**
 * Parses a parameter file into the ParameterSet the engine consumes.
 *
 * Deliberately pure and dependency-free so the same code runs in the build
 * pipeline and in the browser. The site build embeds the parsed set as JSON;
 * nothing in the engine ever touches the filesystem.
 */

import type { Citation, Parameter, ParameterRange, ParameterSet } from '../types.ts';

export class ParameterFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParameterFileError';
  }
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ParameterFileError(`${where} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function parseCitation(raw: unknown, key: string): Citation {
  const c = asRecord(raw, `parameters.${key}.citation`);
  const statute = c['statute'];
  if (typeof statute !== 'string' || statute.length === 0) {
    throw new ParameterFileError(`parameters.${key}.citation.statute is required.`);
  }
  const verified = c['verified'];
  if (typeof verified !== 'boolean') {
    throw new ParameterFileError(
      `parameters.${key}.citation.verified must be an explicit true or false. ` +
        `There is no default: an unstated verification status would let an unchecked ` +
        `citation pass as a checked one.`,
    );
  }
  const verifiedDate = (c['verified_date'] ?? null) as string | null;
  if (verified && !verifiedDate) {
    throw new ParameterFileError(
      `parameters.${key}.citation claims verified: true but has no verified_date. ` +
        `Statute in this area is amended every session, so a verification without a ` +
        `date cannot be aged out and is worth nothing.`,
    );
  }
  return {
    statute,
    session_law: (c['session_law'] ?? null) as string | null,
    source_url: (c['source_url'] ?? null) as string | null,
    quote: (c['quote'] ?? null) as string | null,
    verified,
    verified_date: verifiedDate,
    verified_by: (c['verified_by'] ?? null) as string | null,
  };
}

function parseRange(raw: unknown, key: string): ParameterRange | null {
  if (raw === null || raw === undefined) return null;
  const r = asRecord(raw, `parameters.${key}.range`);
  const low = r['low'];
  const high = r['high'];
  const basis = r['basis'];
  if (typeof low !== 'number' || typeof high !== 'number') {
    throw new ParameterFileError(`parameters.${key}.range needs numeric low and high.`);
  }
  if (low > high) {
    throw new ParameterFileError(`parameters.${key}.range has low greater than high.`);
  }
  if (typeof basis !== 'string' || basis.length === 0) {
    throw new ParameterFileError(
      `parameters.${key}.range.basis is required. A range without a stated basis is a ` +
        `guess wearing the costume of an estimate.`,
    );
  }
  return {
    low,
    high,
    central: (r['central'] ?? null) as number | null,
    basis,
  };
}

export function parseParameterSet(raw: unknown): ParameterSet {
  const doc = asRecord(raw, 'parameter file');

  const fiscalYear = doc['fiscal_year'];
  if (typeof fiscalYear !== 'number') {
    throw new ParameterFileError('fiscal_year is required and must be a number.');
  }

  const status = doc['status'];
  if (status !== 'draft' && status !== 'verified' && status !== 'superseded') {
    throw new ParameterFileError('status must be one of draft, verified, superseded.');
  }

  const rawParams = asRecord(doc['parameters'], 'parameters');
  const parameters = new Map<string, Parameter>();

  for (const [key, value] of Object.entries(rawParams)) {
    const p = asRecord(value, `parameters.${key}`);
    const description = p['description'];
    if (typeof description !== 'string' || description.length === 0) {
      throw new ParameterFileError(
        `parameters.${key}.description is required -- it is the phrase the ` +
          `walkthrough uses to name this parameter to a reader.`,
      );
    }
    const unit = p['unit'];
    if (typeof unit !== 'string') {
      throw new ParameterFileError(`parameters.${key}.unit is required.`);
    }
    const contingent = p['contingent'] === true;
    const citation = parseCitation(p['citation'], key);
    const range = parseRange(p['range'], key);

    // A contingent parameter may hold nothing at all -- that is the honest
    // state before the Legislature acts. What it may never hold is a point
    // value with no range, which would present an unsettled figure as a
    // settled one. Requiring a range outright would be worse than this rule:
    // it would force a range to be invented wherever none can yet be defended.
    if (contingent && p['value'] !== null && p['value'] !== undefined && range === null) {
      throw new ParameterFileError(
        `parameters.${key} is marked contingent and carries a point value but no ` +
          `range. A contingent parameter exists precisely because its value is ` +
          `unsettled; publishing it as a point estimate would be false precision. ` +
          `Either give it a range with a stated basis, or leave its value null.`,
      );
    }

    parameters.set(key, {
      key,
      value: (p['value'] ?? null) as Parameter['value'],
      unit,
      description,
      citation,
      applies_to: (p['applies_to'] ?? null) as string | null,
      range,
      contingent,
    });
  }

  if (parameters.size === 0) {
    throw new ParameterFileError('A parameter file must define at least one parameter.');
  }

  // A file may not claim to be verified while any entry inside it is not.
  if (status === 'verified') {
    const unverified = [...parameters.values()].filter((p) => !p.citation.verified);
    if (unverified.length > 0) {
      throw new ParameterFileError(
        `Parameter file for FY${fiscalYear} declares status: verified but ` +
          `${unverified.length} parameter(s) carry unverified citations: ` +
          `${unverified.map((p) => p.key).join(', ')}.`,
      );
    }
  }

  return {
    fiscal_year: fiscalYear,
    status,
    note: (doc['note'] ?? null) as string | null,
    parameters,
  };
}

/** Parameters whose citations still need checking against current statute text. */
export function unverifiedParameters(set: ParameterSet): Parameter[] {
  return [...set.parameters.values()]
    .filter((p) => !p.citation.verified)
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Citations verified longer ago than `maxAgeDays` and due for re-checking.
 * The legislative-session checklist runs this.
 */
export function staleParameters(set: ParameterSet, asOf: Date, maxAgeDays: number): Parameter[] {
  const cutoff = asOf.getTime() - maxAgeDays * 86_400_000;
  return [...set.parameters.values()]
    .filter((p) => {
      if (!p.citation.verified || !p.citation.verified_date) return false;
      const t = Date.parse(p.citation.verified_date);
      return Number.isFinite(t) && t < cutoff;
    })
    .sort((a, b) => (a.citation.verified_date ?? '').localeCompare(b.citation.verified_date ?? ''));
}
