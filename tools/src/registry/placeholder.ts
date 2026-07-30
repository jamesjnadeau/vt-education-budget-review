/**
 * Placeholder and test-record detection.
 *
 * The AOE production API carries at least one entry that is not a real
 * organization -- an entity named "Test" with org ID "Test", typed
 * "Distance Learning (IS)". Publishing it on a public registry page is the
 * sort of detail a hostile reader would reasonably use to question everything
 * else on the site, so it is filtered out.
 *
 * Two design choices keep the filter from becoming its own hazard.
 *
 * DELIBERATELY CONSERVATIVE. Matching is on the WHOLE name (after stripping
 * generic suffixes like "School" or "District"), not on a substring or a
 * prefix. A real school called "Test Valley Union" would survive; only a
 * record whose entire name is a placeholder token is removed. The patterns
 * were checked against all 830 records in the live snapshot and match exactly
 * one, with no false positives.
 *
 * NEVER SILENT. Every skip emits a warning naming the record, so a
 * false positive shows up in the sync output and in the nightly pull request
 * rather than quietly deleting a real district. A filter that hides what it
 * removes is worse than no filter.
 */

/**
 * Whole-name tokens. A record named exactly one of these is not an organization.
 *
 * Note what is deliberately NOT here: "unknown", "unassigned", "none" and "n/a".
 * Those look like placeholders but are legitimate AOE reporting buckets -- a
 * town record named UNKNOWN is how residency is recorded for pupils whose town
 * is not established, and other records genuinely reference it. Filtering it
 * out would break those references and lose real reporting structure. It is
 * handled instead by `isReportingBucket` below, which keeps the record and
 * marks it as one that must never be awarded ADM.
 */
const PLACEHOLDER_NAMES = new Set([
  'test',
  'tests',
  'testing',
  'test1',
  'test123',
  'sample',
  'example',
  'dummy',
  'placeholder',
  'delete me',
  'deleteme',
  'do not use',
  'donotuse',
  'tbd',
  'todo',
]);

/**
 * Names that are reporting buckets rather than real organizations.
 *
 * These are kept in the registry -- they are part of how AOE reports, and
 * dropping them would break references from records that legitimately point at
 * them. What they must never do is carry membership: no ADM is awarded to a
 * bucket, so it cannot contribute weighted pupils, cannot appear as a member
 * town of a district for funding purposes, and must not be counted in the
 * coverage matrix as a town owing a budget.
 *
 * The registry records this as `reporting_only: true` so the constraint lives
 * in the data rather than in the memory of whoever writes the next query.
 */
const REPORTING_BUCKET_NAMES = new Set([
  'unknown',
  'unassigned',
  'none',
  'n/a',
  'na',
  'not applicable',
  'out of state',
  'outofstate',
  'other',
]);

/** Org ID prefixes that mark a scratch record regardless of its name. */
const PLACEHOLDER_ID_PREFIX = /^(test|sample|example|dummy|placeholder|xxx|zzz)/i;

/**
 * Bare-numeric org IDs in the 900 range: AOE's out-of-state and out-of-country
 * residency buckets.
 *
 * Structural rather than name-based, because the names are compounds -- "Other
 * State -Massachusetts", "Other Out of Country" -- that no whole-name match
 * catches. Real Vermont towns are T-prefixed (T001-T263), and these six are the
 * only bare-numeric org IDs anywhere in the registry, checked across all nine
 * entity files.
 *
 * Deliberately anchored and exactly three digits. T999 ORFORD NH must not match:
 * it is a real New Hampshire town and a real member of the Rivendell Interstate
 * district, which earns no Vermont ADM because it has no Vermont operating
 * district, not because it is a bucket.
 */
const RESIDENCY_BUCKET_ID = /^9\d\d$/;

/** Repeated-character IDs and names, e.g. "XXX", "zzzz". */
const REPEATED_CHARS = /^(x{3,}|z{3,}|0{3,}|9{3,})$/i;

/**
 * Generic nouns an agency appends to a scratch record. Stripped so that
 * "Test School" and "Test District" are caught alongside bare "Test", without
 * having to enumerate every combination.
 */
const GENERIC_SUFFIX = /[\s_-]+(school|district|organization|org|entity|record|account|data|row|su|lea|inc)$/i;

function normalizeName(name: string): string {
  let s = name.trim().toLowerCase().replace(/\s+/g, ' ');
  let previous: string;
  do {
    previous = s;
    s = s.replace(GENERIC_SUFFIX, '');
  } while (s !== previous);
  return s.trim();
}

export interface PlaceholderVerdict {
  readonly isPlaceholder: boolean;
  /** Why, phrased for the warning the sync prints. Null when not a placeholder. */
  readonly reason: string | null;
}

const NOT_PLACEHOLDER: PlaceholderVerdict = { isPlaceholder: false, reason: null };

export function detectPlaceholder(record: {
  readonly id: string | null;
  readonly name: string | null;
}): PlaceholderVerdict {
  const rawName = record.name ?? '';

  if (record.id !== null && rawName.trim() === '') {
    return {
      isPlaceholder: true,
      reason: `org ID "${record.id}" has an empty name, so it cannot be a real organization`,
    };
  }

  if (record.id !== null && PLACEHOLDER_ID_PREFIX.test(record.id)) {
    return {
      isPlaceholder: true,
      reason: `org ID "${record.id}" begins with a scratch-record prefix`,
    };
  }

  if (record.id !== null && REPEATED_CHARS.test(record.id.trim())) {
    return {
      isPlaceholder: true,
      reason: `org ID "${record.id}" is a repeated-character filler value`,
    };
  }

  const normalized = normalizeName(rawName);
  if (PLACEHOLDER_NAMES.has(normalized) || REPEATED_CHARS.test(normalized)) {
    return {
      isPlaceholder: true,
      reason: `the name "${rawName.trim()}" is a placeholder rather than an organization name`,
    };
  }

  return NOT_PLACEHOLDER;
}

/**
 * Whether a record is an AOE reporting bucket rather than a real organization.
 * Matched two ways: structurally by a bare-numeric 900-range org ID, or by
 * whole-name match against the known bucket names.
 *
 * A bucket stays in the registry and keeps its references, but no average daily
 * membership is awarded to it. Everything downstream must honour that: it
 * contributes no pupils to weighted membership, it is not a town that owes a
 * budget in the coverage matrix, and a merger scenario cannot move students
 * into or out of it.
 */
export function isReportingBucket(record: {
  readonly id: string | null;
  readonly name: string | null;
}): boolean {
  if (record.id !== null && RESIDENCY_BUCKET_ID.test(record.id.trim())) return true;
  if (!record.name) return false;
  return REPORTING_BUCKET_NAMES.has(normalizeName(record.name));
}
