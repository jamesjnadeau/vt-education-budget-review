/**
 * The repository_dispatch payload for a web submission, and the validation
 * that turns a received payload into a checked submission. GitHub caps a
 * client_payload at 10 top-level keys, so the form fields nest under `fields`.
 */
import { checkFields, type CheckedFields } from '../intake/rules.ts';

export interface WebIntakePayload {
  submission_id: string;
  upload_id: string | null;
  entity: string;
  fiscal_year: string;
  fields: {
    document_url: string | null;
    source_url: string | null;
    retrieved_date: string | null;
    retrieval_method: string | null;
    document_type: string | null;
    note: string | null;
    name: string | null;
  };
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Copy only the named keys; everything else (email, honeypot, token) is dropped. */
export function toDispatchPayload(
  submissionId: string,
  data: Readonly<Record<string, unknown>>,
): WebIntakePayload {
  return {
    submission_id: submissionId,
    upload_id: clean(data.upload_id),
    entity: clean(data.entity) ?? '',
    fiscal_year: clean(data.fiscal_year) ?? '',
    fields: {
      document_url: clean(data.document_url),
      source_url: clean(data.source_url),
      retrieved_date: clean(data.retrieved_date),
      retrieval_method: clean(data.retrieval_method),
      document_type: clean(data.document_type),
      note: clean(data.note),
      name: clean(data.name),
    },
  };
}

export type WebSource =
  | { kind: 'upload'; uploadId: string }
  | { kind: 'link'; url: string };

export interface WebSubmission extends CheckedFields {
  submissionId: string;
  source: WebSource;
  name: string | null;
}

const FIELD_KEYS = [
  'document_url',
  'source_url',
  'retrieved_date',
  'retrieval_method',
  'document_type',
  'note',
  'name',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): boolean {
  return value === null || value === undefined || typeof value === 'string';
}

export function buildWebSubmission(
  payload: unknown,
  knownSlugs: ReadonlySet<string>,
):
  | { ok: true; submission: WebSubmission }
  | { ok: false; errors: string[]; entity: string; fiscalYear: string } {
  if (!isRecord(payload)) {
    return {
      ok: false,
      errors: ['The submission payload is not an object.'],
      entity: 'unknown',
      fiscalYear: 'unknown',
    };
  }

  // Trimmed like every other field, so the failure issue shows what was checked.
  const entity = clean(payload.entity) ?? 'unknown';
  const fiscalYear = clean(payload.fiscal_year) ?? 'unknown';
  const fail = (errors: string[]) => ({
    ok: false as const,
    errors,
    entity,
    fiscalYear,
  });

  // --- shape: every field must be a string (or absent/null) ---------------
  const shapeErrors: string[] = [];
  for (const key of ['submission_id', 'upload_id', 'entity', 'fiscal_year']) {
    if (!isStringOrNull(payload[key])) {
      shapeErrors.push(`Field '${key}' must be a string.`);
    }
  }
  if (payload.fields !== undefined && !isRecord(payload.fields)) {
    shapeErrors.push(`Field 'fields' must be an object.`);
  }
  const fields = isRecord(payload.fields) ? payload.fields : {};
  for (const key of FIELD_KEYS) {
    if (!isStringOrNull(fields[key])) {
      shapeErrors.push(`Field 'fields.${key}' must be a string.`);
    }
  }
  if (shapeErrors.length > 0) return fail(shapeErrors);

  const submissionId = clean(payload.submission_id);
  const uploadId = clean(payload.upload_id);
  const documentUrl = clean(fields.document_url);

  const errors: string[] = [];
  if (!submissionId) errors.push('The submission has no submission_id.');

  let source: WebSource | null = null;
  if (uploadId && documentUrl) {
    errors.push('Send either a file or a link, not both.');
  } else if (!uploadId && !documentUrl) {
    errors.push('Send a file or a link to the document.');
  } else if (uploadId) {
    source = { kind: 'upload', uploadId };
  } else if (documentUrl) {
    if (!documentUrl.startsWith('https://')) {
      errors.push(`The document link '${documentUrl}' must start with https://.`);
    } else {
      source = { kind: 'link', url: documentUrl };
    }
  }

  const checked = checkFields(
    {
      entity: clean(payload.entity),
      fiscalYear: clean(payload.fiscal_year),
      sourceUrl: clean(fields.source_url),
      retrievedDate: clean(fields.retrieved_date),
      retrievalMethod: clean(fields.retrieval_method),
      documentType: clean(fields.document_type),
      note: clean(fields.note),
    },
    knownSlugs,
  );
  if (!checked.ok) errors.push(...checked.errors);

  if (errors.length > 0 || !checked.ok || !source || !submissionId) {
    return fail(errors);
  }
  return {
    ok: true,
    submission: {
      ...checked.fields,
      submissionId,
      source,
      name: clean(fields.name),
    },
  };
}
