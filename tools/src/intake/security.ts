/**
 * The security boundary for attacker-supplied intake.
 *
 * The intake workflow downloads a URL an anonymous stranger put in an issue and
 * commits the bytes. Every function here is one of the load-bearing checks that
 * makes that safe, kept pure so the hostile cases are unit-tested rather than
 * discovered in production:
 *
 *   - the filename comes from attacker-controlled link text and must not be
 *     allowed to write outside its directory or land as a non-LFS blob;
 *   - the URL must point at a GitHub attachment host, so the workflow cannot be
 *     turned into a fetch proxy for an arbitrary server;
 *   - the bytes must actually be the file type the extension claims.
 */

/** GitHub caps "all other files" (PDFs, spreadsheets) on an issue at 25 MB. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/**
 * Extensions the artifact may carry, matching the LFS filters in
 * `.gitattributes` exactly. Lowercased here and compared case-insensitively:
 * that file tracks both `*.pdf` and `*.PDF`, so a `.Pdf` accepted by a
 * case-sensitive check would land as a plain git blob and defeat the whole LFS
 * decision this channel is built on.
 */
const ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'doc', 'docx', 'zip'] as const;

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
};

// First bytes each extension's format must begin with. OOXML files (xlsx,
// docx) and zips are ZIP containers; legacy Office files (xls, doc) are OLE2
// compound documents.
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const MAGIC: Readonly<Record<string, readonly number[]>> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // "%PDF-"
  xlsx: [0x50, 0x4b], // "PK"
  docx: [0x50, 0x4b],
  zip: [0x50, 0x4b],
  xls: OLE2,
  doc: OLE2,
};

// Control characters (C0 range and DEL). A released filename never contains
// one; an attacker-supplied name might, to hide a payload or break a later
// consumer.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

function extensionOf(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return null;
  return filename.slice(dot + 1).toLowerCase();
}

/**
 * A human-readable reason the filename is unacceptable, or null when it is
 * fine. Rejects path separators, `..`, leading dots and control characters, and
 * requires an extension on the LFS allowlist. The name is never rewritten: an
 * artifact is stored exactly as the district released it, so an unacceptable
 * name is a rejection, not a cleanup.
 */
export function filenameError(filename: string): string | null {
  if (!filename) return 'the attachment has no filename.';
  if (filename.includes('/') || filename.includes('\\')) {
    return `"${filename}" contains a path separator. A filename cannot name a directory.`;
  }
  if (filename.includes('..')) {
    return `"${filename}" contains "..", which could climb out of its directory.`;
  }
  if (filename.startsWith('.')) {
    return `"${filename}" starts with a dot.`;
  }
  if (CONTROL_CHARS.test(filename)) {
    return `"${filename.replace(new RegExp(CONTROL_CHARS, 'g'), '?')}" contains a control character.`;
  }
  const ext = extensionOf(filename);
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return (
      `"${filename}" does not end in one of ${ALLOWED_EXTENSIONS.join(', ')}. Only the ` +
      `document types the repository stores in Git LFS can be accepted here.`
    );
  }
  return null;
}

const ALLOWED_HOSTS = new Set(['objects.githubusercontent.com', 'user-images.githubusercontent.com']);

/**
 * Whether the URL points at a GitHub attachment store. Only `https`, only the
 * known hosts, and `github.com` only under `/user-attachments/`. An exact host
 * match (not a suffix test) rejects lookalikes such as
 * `objects.githubusercontent.com.evil.com`; the URL parser normalises away any
 * `..` in the path before the prefix test.
 *
 * GitHub uses two `/user-attachments/` shapes: `/assets/<uuid>` for images and
 * videos, and `/files/<id>/<name>` for every other file type -- which is what a
 * dragged-in PDF or spreadsheet, the whole point of this channel, gets. Both
 * are accepted; a bare `/user-attachments/...` with neither segment is not.
 */
export function isAllowedAttachmentUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.hostname === 'github.com') {
    return (
      parsed.pathname.startsWith('/user-attachments/assets/') ||
      parsed.pathname.startsWith('/user-attachments/files/')
    );
  }
  return ALLOWED_HOSTS.has(parsed.hostname);
}

/** Whether the bytes begin with the signature the extension's format requires. */
export function magicBytesMatch(filename: string, bytes: Buffer): boolean {
  const ext = extensionOf(filename);
  if (!ext) return false;
  const signature = MAGIC[ext];
  if (!signature) return false;
  if (bytes.length < signature.length) return false;
  return signature.every((b, i) => bytes[i] === b);
}

/** The media type for an allowlisted extension, or null. */
export function mediaTypeFor(filename: string): string | null {
  const ext = extensionOf(filename);
  return ext ? (MEDIA_TYPES[ext] ?? null) : null;
}

/**
 * Reasons the downloaded bytes are unacceptable, or an empty array. Checks the
 * size cap and that the bytes actually are the format the extension claims --
 * both of which can only be known once the file is in hand, unlike the filename
 * checks above. Assumes `filenameError` already passed, so the extension is on
 * the allowlist.
 */
export function contentErrors(filename: string, bytes: Buffer): string[] {
  const errors: string[] = [];
  if (bytes.length > MAX_ATTACHMENT_BYTES) {
    const mb = (bytes.length / (1024 * 1024)).toFixed(1);
    errors.push(
      `the attachment is ${mb} MB, over GitHub's 25 MB limit for issue files. ` +
        `This is the one failure you cannot fix by editing the issue -- see CONTRIBUTING.md ` +
        `for the clone-and-push path oversize documents still use.`,
    );
  }
  if (!magicBytesMatch(filename, bytes)) {
    const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
    errors.push(
      `the bytes do not begin with the signature a ${ext} file must have. The attachment is ` +
        `not the type its name claims -- send the document exactly as the district released it.`,
    );
  }
  return errors;
}
