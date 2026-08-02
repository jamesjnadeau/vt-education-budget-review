/**
 * Parses a parameter file into the ParameterSet the engine consumes.
 *
 * Deliberately pure and dependency-free so the same code runs in the build
 * pipeline and in the browser. The site build embeds the parsed set as JSON;
 * nothing in the engine ever touches the filesystem.
 */

import type { Citation, Parameter, ParameterRange, ParameterSet, PublishedInput } from '../types.ts';

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

/**
 * Parses the optional `inputs:` block: published determinations the formula
 * consumes, kept distinct from statutory `parameters`. Absent block -> empty
 * map. A value may be null (the determination for the year is not yet
 * published), but every entry still needs a unit, a description and a citation,
 * because a figure with no source is exactly what this block exists to prevent.
 */
function parseInputs(raw: unknown): Map<string, PublishedInput> {
  const inputs = new Map<string, PublishedInput>();
  if (raw === null || raw === undefined) return inputs;

  const rawInputs = asRecord(raw, 'inputs');
  for (const [key, value] of Object.entries(rawInputs)) {
    const i = asRecord(value, `inputs.${key}`);
    const description = i['description'];
    if (typeof description !== 'string' || description.length === 0) {
      throw new ParameterFileError(
        `inputs.${key}.description is required -- it is the phrase the walkthrough ` +
          `uses to name this input to a reader.`,
      );
    }
    const unit = i['unit'];
    if (typeof unit !== 'string') {
      throw new ParameterFileError(`inputs.${key}.unit is required.`);
    }
    const rawValue = i['value'];
    if (rawValue !== null && rawValue !== undefined && typeof rawValue !== 'number') {
      throw new ParameterFileError(
        `inputs.${key}.value must be a number or null. A published input is a ` +
          `numeric determination; leave it null until the figure is published.`,
      );
    }
    inputs.set(key, {
      key,
      value: (rawValue ?? null) as number | null,
      unit,
      description,
      citation: parseCitation(i['citation'], key),
    });
  }
  return inputs;
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

    // Absent means true. These files are statutory parameter sets, so a
    // parameter that is NOT law is the exceptional case and has to say so.
    const isLaw = p['is_law'] !== false;

    // A proposal cannot cite a statute section, because if it could there would
    // be nothing to propose. This catches the failure the verification rule
    // guards against, running backwards: a committee's recommendation dressed
    // in a V.S.A. citation reads as settled law to every downstream renderer.
    if (!isLaw && /\bV\.S\.A\./.test(citation.statute)) {
      throw new ParameterFileError(
        `parameters.${key} is marked is_law: false but cites "${citation.statute}", ` +
          `which is a statute section. A proposed threshold has no statutory citation. ` +
          `Cite the document that proposed it, or drop is_law: false because it is law.`,
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
      is_law: isLaw,
      structural_note: (p['structural_note'] ?? null) as string | null,
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
    inputs: parseInputs(doc['inputs']),
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
