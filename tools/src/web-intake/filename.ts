import { ALLOWED_EXTENSIONS, extensionOf, filenameError } from '../intake/security.ts';

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/zip': 'zip',
};

// The shared filename rules accept spaces and punctuation; the web form is
// stricter and keeps only names that are safe everywhere without quoting.
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type FilenameChoice = { ok: true; filename: string; generated: boolean } | { ok: false; error: string };

export function chooseWebFilename(input: {
  original: string | null;
  contentType: string | null;
  entityDir: string;
  fiscalYear: number;
  documentType: string;
}): FilenameChoice {
  const { original, contentType, entityDir, fiscalYear, documentType } = input;
  if (original && filenameError(original) === null && SAFE_NAME.test(original)) {
    return { ok: true, filename: original, generated: false };
  }

  let ext: string | null = null;
  const fromName = original ? extensionOf(original) : null;
  if (fromName && (ALLOWED_EXTENSIONS as readonly string[]).includes(fromName)) {
    ext = fromName;
  } else if (contentType) {
    const mime = contentType.split(';')[0]!.trim().toLowerCase();
    ext = CONTENT_TYPE_EXTENSIONS[mime] ?? null;
  }
  if (!ext) {
    return {
      ok: false,
      error:
        "Couldn't tell what kind of file this is. Rename it so it ends in one of " +
        `${ALLOWED_EXTENSIONS.join(', ')} and try again.`,
    };
  }

  const filename = `${entityDir}-fy${fiscalYear}-${documentType}.${ext}`;
  const problem = filenameError(filename);
  if (problem) return { ok: false, error: `Couldn't generate a usable filename: ${problem}` };
  return { ok: true, filename, generated: true };
}
