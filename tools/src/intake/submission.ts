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
export { DOCUMENT_TYPES, RETRIEVAL_METHODS } from './rules.ts';
import { checkFields } from './rules.ts';
import { filenameError, isAllowedAttachmentUrl } from './security.ts';

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

export function buildSubmission(inputData: SubmissionInput): SubmissionResult {
  const form = parseIssueForm(inputData.body);
  const errors: string[] = [];
  const get = (label: string): string | null => form.get(label) ?? null;

  const fieldCheck = checkFields(
    {
      entity: get('entity'),
      fiscalYear: get('fiscal year'),
      sourceUrl: get('source url'),
      retrievedDate: get('retrieved date'),
      retrievalMethod: get('retrieval method'),
      documentType: get('document type'),
      note: get('note'),
    },
    inputData.knownSlugs,
  );
  if (!fieldCheck.ok) errors.push(...fieldCheck.errors);

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

  if (errors.length > 0 || !fieldCheck.ok) return { ok: false, errors };

  const fields = fieldCheck.fields;
  return {
    ok: true,
    submission: {
      entity: fields.entity,
      entityDir: fields.entityDir,
      fiscalYear: fields.fiscalYear,
      attachmentUrl,
      filename,
      sourceUrl: fields.sourceUrl,
      retrievedDate: fields.retrievedDate,
      retrievalMethod: fields.retrievalMethod,
      documentType: fields.documentType,
      note: fields.note,
      retrievedBy: `@${inputData.authorLogin}`,
    },
  };
}
