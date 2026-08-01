/**
 * Turning a parsed issue-form body into a validated submission, or a list of
 * the specific reasons it cannot be accepted.
 *
 * This is the form's schema enforced in code. The issue form collects what a
 * human knows; this rejects anything the provenance schema would later reject,
 * before a branch or PR exists -- so a contributor learns their retrieval
 * method is misspelled from a comment on their own issue, not from a red check
 * on a PR a bot opened. Every problem is collected rather than short-circuited,
 * so one round of fixing clears them all.
 *
 * Four provenance fields are never collected here: `sha256`, `bytes` and
 * `media_type` are computed from the received bytes, and `retrieved_by` is the
 * issue author's handle. Trusting a human to paste a hash correctly is the one
 * place the current flow can silently break the guarantee the schema exists to
 * make.
 */

import { findAttachments, parseIssueForm } from './parse.ts';
import { filenameError, isAllowedAttachmentUrl } from './security.ts';

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

export interface SubmissionInput {
  readonly body: string;
  /** The issue author's GitHub login, recorded as `@login`. */
  readonly authorLogin: string;
  /** Every registry slug, so a prefilled-then-edited entity can be rejected. */
  readonly knownSlugs: ReadonlySet<string>;
}

export interface Submission {
  readonly entity: string;
  /** The slug's slash replaced by a dash, since a directory cannot hold one. */
  readonly entityDir: string;
  readonly fiscalYear: number;
  readonly attachmentUrl: string;
  readonly filename: string;
  readonly sourceUrl: string | null;
  readonly retrievedDate: string;
  readonly retrievalMethod: string;
  readonly documentType: string;
  readonly note: string | null;
  readonly retrievedBy: string;
}

export type SubmissionResult =
  | { readonly ok: true; readonly submission: Submission }
  | { readonly ok: false; readonly errors: readonly string[] };

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function buildSubmission(inputData: SubmissionInput): SubmissionResult {
  const form = parseIssueForm(inputData.body);
  const errors: string[] = [];
  const get = (label: string): string | null => form.get(label) ?? null;

  // --- entity -------------------------------------------------------------
  const entity = get('entity');
  let entityDir = '';
  if (!entity) {
    errors.push('Entity is required. It is prefilled from the coverage cell; do not clear it.');
  } else if (!inputData.knownSlugs.has(entity)) {
    errors.push(
      `Entity "${entity}" is not a known registry entity. Use the slug exactly as the coverage ` +
        `page prefilled it (e.g. su/addison-central), or run \`npm run registry:sync\` if it is new.`,
    );
  } else {
    entityDir = entity.replace('/', '-');
  }

  // --- fiscal year --------------------------------------------------------
  const fyRaw = get('fiscal year');
  let fiscalYear = 0;
  if (!fyRaw) {
    errors.push('Fiscal year is required.');
  } else if (!/^\d{4}$/.test(fyRaw)) {
    errors.push(`Fiscal year "${fyRaw}" is not a four-digit year.`);
  } else {
    fiscalYear = Number(fyRaw);
    if (fiscalYear < FIRST_FY || fiscalYear > LAST_FY) {
      errors.push(`Fiscal year ${fiscalYear} is outside the accepted range ${FIRST_FY}-${LAST_FY}.`);
    }
  }

  // --- the attachment -----------------------------------------------------
  const attachments = findAttachments(inputData.body);
  let filename = '';
  let attachmentUrl = '';
  if (attachments.length === 0) {
    errors.push(
      'No document is attached. Drag the PDF or spreadsheet into the Document field so it ' +
        'uploads as an attachment.',
    );
  } else if (attachments.length > 1) {
    errors.push(
      `${attachments.length} attachments are present, but each document needs its own source, ` +
        `date and type. Send one document per issue; open a second issue for the second file.`,
    );
  } else {
    const only = attachments[0];
    filename = only?.text ?? '';
    attachmentUrl = only?.url ?? '';
    const nameProblem = filenameError(filename);
    if (nameProblem) errors.push(nameProblem);
    if (!isAllowedAttachmentUrl(attachmentUrl)) {
      errors.push(
        `The attachment URL is not on a GitHub attachment host. Only files uploaded to the ` +
          `issue itself are accepted; a link to an external site is not.`,
      );
    }
  }

  // --- retrieval method (needed before the source_url rule) ---------------
  const retrievalMethod = get('retrieval method');
  const methodValid = retrievalMethod !== null && (RETRIEVAL_METHODS as readonly string[]).includes(retrievalMethod);
  if (!retrievalMethod) {
    errors.push('Retrieval method is required.');
  } else if (!methodValid) {
    errors.push(
      `Retrieval method "${retrievalMethod}" is not one of ${RETRIEVAL_METHODS.join(', ')}. ` +
        `Choose from the dropdown rather than typing a value.`,
    );
  }

  // --- source URL and note ------------------------------------------------
  const sourceUrlRaw = get('source url');
  const note = get('note');
  const nullSourceAllowed = methodValid && NULL_SOURCE_METHODS.has(retrievalMethod);
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
      errors.push(`Source URL "${sourceUrlRaw}" is not a valid URL.`);
    }
  }

  // --- retrieved date -----------------------------------------------------
  const retrievedDate = get('retrieved date');
  if (!retrievedDate) {
    errors.push('Retrieved date is required.');
  } else if (!isIsoDate(retrievedDate)) {
    errors.push(`Retrieved date "${retrievedDate}" is not an ISO date (YYYY-MM-DD).`);
  }

  // --- document type ------------------------------------------------------
  const documentType = get('document type');
  if (!documentType) {
    errors.push('Document type is required.');
  } else if (!(DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
    errors.push(
      `Document type "${documentType}" is not one of ${DOCUMENT_TYPES.join(', ')}. ` +
        `Choose from the dropdown rather than typing a value.`,
    );
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    submission: {
      entity: entity as string,
      entityDir,
      fiscalYear,
      attachmentUrl,
      filename,
      sourceUrl,
      retrievedDate: retrievedDate as string,
      retrievalMethod: retrievalMethod as string,
      documentType: documentType as string,
      note,
      retrievedBy: `@${inputData.authorLogin}`,
    },
  };
}
