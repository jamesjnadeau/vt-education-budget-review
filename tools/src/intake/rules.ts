/**
 * The field rules shared by every intake channel (GitHub issue form and web
 * form): the provenance schema's enums and the checks that reject anything the
 * schema would later reject. Every problem is collected, not short-circuited.
 */

// Verbatim copies of the provenance schema's enums. The issue-form dropdowns
// carry the same lists, and this is the check that a submission cannot record a
// value the validator will later reject.
export const RETRIEVAL_METHODS = [
  'http-fetch',
  'scrape',
  'manual-download',
  'email',
  'in_person',
  'foia',
] as const;

export const DOCUMENT_TYPES = [
  'annual_report',
  'budget_book',
  'town_meeting_warning',
  'board_presentation',
  'spreadsheet',
  'aoe_report',
  'tax_department_report',
  'other',
] as const;

// The schema permits a null source_url only for these two methods, and then
// requires a note to say where the document came from. `foia` is deliberately
// not here: a records request has a reference to cite, so it needs a source_url
// like any fetch.
const NULL_SOURCE_METHODS = new Set(['email', 'in_person']);

// Schema bounds on fiscal_year.
const FIRST_FY = 2015;
const LAST_FY = 2100;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export interface RawFields {
  readonly entity: string | null;
  readonly fiscalYear: string | null;
  readonly sourceUrl: string | null;
  readonly retrievedDate: string | null;
  readonly retrievalMethod: string | null;
  readonly documentType: string | null;
  readonly note: string | null;
}

export interface CheckedFields {
  readonly entity: string;
  /** The slug's slash replaced by a dash, since a directory cannot hold one. */
  readonly entityDir: string;
  readonly fiscalYear: number;
  readonly sourceUrl: string | null;
  readonly retrievedDate: string;
  readonly retrievalMethod: string;
  readonly documentType: string;
  readonly note: string | null;
}

export function checkFields(
  raw: RawFields,
  knownSlugs: ReadonlySet<string>,
): { ok: true; fields: CheckedFields } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  // --- entity -------------------------------------------------------------
  const entity = raw.entity;
  let entityDir = '';
  if (!entity) {
    errors.push(
      'Entity is required. It is prefilled from the coverage cell; do not clear it.',
    );
  } else if (!knownSlugs.has(entity)) {
    errors.push(
      `Entity '${entity}' is not a known registry entity. Use the slug exactly as the coverage ` +
        `page prefilled it (e.g. su/addison-central), or run \`npm run registry:sync\` if it is new.`,
    );
  } else {
    entityDir = entity.replace('/', '-');
  }

  // --- fiscal year --------------------------------------------------------
  const fyRaw = raw.fiscalYear;
  let fiscalYear = 0;
  if (!fyRaw) {
    errors.push('Fiscal year is required.');
  } else if (!/^\d{4}$/.test(fyRaw)) {
    errors.push(`Fiscal year '${fyRaw}' is not a four-digit year.`);
  } else {
    fiscalYear = Number(fyRaw);
    if (fiscalYear < FIRST_FY || fiscalYear > LAST_FY) {
      errors.push(
        `Fiscal year ${fiscalYear} is outside the accepted range ${FIRST_FY}-${LAST_FY}.`,
      );
    }
  }

  // --- retrieval method (needed before the source_url rule) ---------------
  const retrievalMethod = raw.retrievalMethod;
  const methodValid =
    retrievalMethod !== null &&
    (RETRIEVAL_METHODS as readonly string[]).includes(retrievalMethod);
  if (!retrievalMethod) {
    errors.push('Retrieval method is required.');
  } else if (!methodValid) {
    errors.push(
      `Retrieval method '${retrievalMethod}' is not one of ${RETRIEVAL_METHODS.join(', ')}. ` +
        `Choose from the dropdown rather than typing a value.`,
    );
  }

  // --- source URL and note ------------------------------------------------
  const sourceUrlRaw = raw.sourceUrl;
  const note = raw.note;
  const nullSourceAllowed =
    methodValid && NULL_SOURCE_METHODS.has(retrievalMethod);
  let sourceUrl: string | null = sourceUrlRaw;
  if (!sourceUrlRaw) {
    sourceUrl = null;
    if (!nullSourceAllowed) {
      errors.push(
        `Source URL is required unless the document was obtained by email or in person. ` +
          `Give the URL you retrieved it from.`,
      );
    } else if (!note) {
      errors.push(
        `A document with no source URL needs a note explaining where it came from ` +
          `(who sent it, or where you collected it, and when).`,
      );
    }
  } else {
    try {
      // eslint-disable-next-line no-new
      new URL(sourceUrlRaw);
    } catch {
      errors.push(`Source URL '${sourceUrlRaw}' is not a valid URL.`);
    }
  }

  // --- retrieved date -----------------------------------------------------
  const retrievedDate = raw.retrievedDate;
  if (!retrievedDate) {
    errors.push('Retrieved date is required.');
  } else if (!isIsoDate(retrievedDate)) {
    errors.push(
      `Retrieved date '${retrievedDate}' is not an ISO date (YYYY-MM-DD).`,
    );
  }

  // --- document type ------------------------------------------------------
  const documentType = raw.documentType;
  if (!documentType) {
    errors.push('Document type is required.');
  } else if (!(DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
    errors.push(
      `Document type '${documentType}' is not one of ${DOCUMENT_TYPES.join(', ')}. ` +
        `Choose from the dropdown rather than typing a value.`,
    );
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    fields: {
      entity: entity as string,
      entityDir,
      fiscalYear,
      sourceUrl,
      retrievedDate: retrievedDate as string,
      retrievalMethod: retrievalMethod as string,
      documentType: documentType as string,
      note,
    },
  };
}
