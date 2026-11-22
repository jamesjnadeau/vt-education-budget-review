/**
 * The browser side of the /contribute/ form: the checks that mirror the
 * server's rules, and the chunked upload to the Netlify functions.
 *
 * Everything here is pure or takes its I/O as an argument, so it runs under
 * vitest without a DOM. The page wires it to the form.
 */

import { CHUNK_BYTES, MAX_WEB_BYTES } from '../../../tools/src/web-intake/limits.ts';
import { DOCUMENT_TYPES, RETRIEVAL_METHODS, isIsoDate } from '../../../tools/src/intake/rules.ts';
import { ALLOWED_EXTENSIONS, extensionOf, filenameError } from '../../../tools/src/intake/security.ts';

export { ALLOWED_EXTENSIONS, CHUNK_BYTES, DOCUMENT_TYPES, MAX_WEB_BYTES, RETRIEVAL_METHODS };

/** Plain-language labels; the schema enum is the option's value. */
export const RETRIEVAL_METHOD_LABELS: Readonly<Record<(typeof RETRIEVAL_METHODS)[number], string>> = {
  'manual-download': 'I downloaded it from a website',
  'http-fetch': 'I fetched it from a web address',
  scrape: 'I copied it out of a web page',
  email: 'Someone emailed it to me',
  in_person: 'I picked it up in person (handout, meeting, office)',
  foia: 'I got it through a public records request',
};

export const DOCUMENT_TYPE_LABELS: Readonly<Record<(typeof DOCUMENT_TYPES)[number], string>> = {
  budget_book: 'Budget book or proposed budget',
  annual_report: 'Annual report',
  town_meeting_warning: 'Town meeting warning',
  board_presentation: 'Board presentation or slides',
  spreadsheet: 'Spreadsheet of budget figures',
  aoe_report: 'Agency of Education report',
  tax_department_report: 'Tax Department report',
  other: 'Something else',
};

export interface FormState {
  /** A file has finished uploading. */
  hasUpload: boolean;
  /** A file is uploading right now. */
  uploading: boolean;
  documentUrl: string;
  sourceUrl: string;
  retrievedDate: string;
  retrievalMethod: string;
  note: string;
  fileName: string | null;
  fileBytes: number | null;
}

const MAX_MB = Math.round(MAX_WEB_BYTES / (1024 * 1024));
const NO_SOURCE_METHODS = new Set(['email', 'in_person']);

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Problems with a chosen file alone, so the page can check before uploading. */
export function fileErrors(fileName: string, fileBytes: number): string[] {
  const errors: string[] = [];
  const ext = extensionOf(fileName);
  if (!ext || !(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    errors.push(`The file must be one of: ${ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(', ')}.`);
  } else if (filenameError(fileName) !== null || fileName.length > 255) {
    errors.push('This file name cannot be used. Please rename the file with plain letters and numbers, then choose it again.');
  }
  if (fileBytes <= 0) errors.push('That file is empty.');
  else if (fileBytes > MAX_WEB_BYTES) {
    errors.push(`That file is larger than ${MAX_MB} MB. Please paste a link to it instead.`);
  }
  return errors;
}

/** Every reason the form cannot be sent yet, in plain language. */
export function clientErrors(s: FormState): string[] {
  const errors: string[] = [];
  const link = s.documentUrl.trim();
  const source = s.sourceUrl.trim();
  const note = s.note.trim();
  const hasFile = s.hasUpload || s.uploading;

  if (s.fileName !== null) errors.push(...fileErrors(s.fileName, s.fileBytes ?? 0));
  if (s.uploading) errors.push('Please wait for the file to finish uploading.');

  if (hasFile && link !== '') {
    errors.push('Send either a file or a link, not both.');
  } else if (!hasFile && link === '') {
    errors.push('Choose a file, or paste a link to the document.');
  } else if (link !== '') {
    if (link.startsWith('http://')) errors.push('The link to the document must start with https://, not http://.');
    else if (!link.startsWith('https://') || !isUrl(link)) errors.push('The link to the document is not a valid https:// address.');
  }

  if (!NO_SOURCE_METHODS.has(s.retrievalMethod) && source === '') {
    errors.push('Tell us the web page you found it on, or choose email or in person above.');
  } else if (source !== '' && !isUrl(source)) {
    errors.push('The web page address you gave is not a valid address.');
  } else if (source === '' && note === '') {
    errors.push('Because there is no web page, please say in the note who sent it or where you got it, and when.');
  }

  if (!isIsoDate(s.retrievedDate)) errors.push('Please give the date you got the document.');
  return errors;
}

/** Half-open byte ranges covering `bytes` in pieces of at most `chunkBytes`. */
export function chunkRanges(bytes: number, chunkBytes: number): Array<[start: number, end: number]> {
  const ranges: Array<[number, number]> = [];
  if (!(bytes > 0) || !(chunkBytes > 0)) return ranges;
  for (let start = 0; start < bytes; start += chunkBytes) ranges.push([start, Math.min(start + chunkBytes, bytes)]);
  return ranges;
}

export interface UploadOptions {
  fetchImpl?: typeof fetch;
  /** Called with 0..1; the last call is 1 once the upload is finished. */
  onProgress?: (fraction: number) => void;
  /** Extra tries for each chunk after the first attempt. Default 3. */
  retries?: number;
  /** Base wait before a retry, multiplied by the attempt number. Default 700. */
  retryDelayMs?: number;
}

const START_URL = '/api/intake-upload/start';
const NETWORK_MESSAGE = 'The connection was interrupted. Please check your internet connection and try again.';

class ServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function serverError(res: Response): Promise<ServerError> {
  let message = `Something went wrong (error ${res.status}). Please try again.`;
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error !== '') message = body.error;
  } catch {
    // keep the generic message
  }
  return new ServerError(message, res.status);
}

async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const retryable = (e: unknown) => !(e instanceof ServerError) || e.status >= 500 || e.status === 408 || e.status === 429;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Upload `file` through the start / chunk / done functions and resolve to the
 * upload id. The write token the server returns lives only in this function's
 * scope: it is sent as a bearer header and never stored or returned.
 */
export async function uploadFile(
  file: Blob & { readonly name: string },
  turnstileToken: string,
  opts: UploadOptions = {},
): Promise<string> {
  const doFetch = opts.fetchImpl ?? fetch;
  const retries = opts.retries ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 700;
  const send = async (url: string, init: RequestInit): Promise<Response> => {
    let res: Response;
    try {
      res = await doFetch(url, init);
    } catch {
      throw new Error(NETWORK_MESSAGE);
    }
    if (!res.ok) throw await serverError(res);
    return res;
  };

  const sha256 = await sha256Hex(file);
  const startRes = await send(START_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename: file.name, bytes: file.size, sha256, turnstileToken }),
  });
  const started = (await startRes.json()) as { id?: unknown; token?: unknown; chunkBytes?: unknown };
  const { id, token } = started;
  const chunkBytes = typeof started.chunkBytes === 'number' ? started.chunkBytes : CHUNK_BYTES;
  if (typeof id !== 'string' || typeof token !== 'string') throw new Error('The server gave an unexpected answer. Please try again.');

  const auth = { authorization: `Bearer ${token}` };
  const ranges = chunkRanges(file.size, chunkBytes);
  opts.onProgress?.(0);
  for (const [n, [start, end]] of ranges.entries()) {
    for (let attempt = 0; ; attempt++) {
      try {
        await send(`/api/intake-upload/${id}/${n}`, { method: 'PUT', headers: auth, body: file.slice(start, end) });
        break;
      } catch (e) {
        if (attempt >= retries || !retryable(e)) throw e;
        await sleep(retryDelayMs * (attempt + 1));
      }
    }
    opts.onProgress?.(end / file.size);
  }
  await send(`/api/intake-upload/${id}/done`, { method: 'POST', headers: auth });
  opts.onProgress?.(1);
  return id;
}

/**
 * Holds the callers waiting for a Turnstile token. `give` hands the token to
 * every waiter; `fail` rejects every waiter so nobody waits forever after the
 * widget errors out.
 */
export interface TokenWaiters {
  wait(): Promise<string>;
  give(token: string): void;
  fail(error: Error): void;
  readonly size: number;
}

export function createTokenWaiters(): TokenWaiters {
  let waiters: Array<{ resolve: (t: string) => void; reject: (e: Error) => void }> = [];
  return {
    wait: () => new Promise((resolve, reject) => void waiters.push({ resolve, reject })),
    give(token) {
      const taken = waiters;
      waiters = [];
      for (const w of taken) w.resolve(token);
    },
    fail(error) {
      const taken = waiters;
      waiters = [];
      for (const w of taken) w.reject(error);
    },
    get size() {
      return waiters.length;
    },
  };
}
