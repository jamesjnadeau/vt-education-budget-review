/** The GitHub-side client for the Netlify download routes (signed requests). */
import { createHash } from 'node:crypto';

import { MAX_WEB_BYTES } from './limits.ts';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, signRequest } from './signing.ts';
import type { UploadMeta } from './uploads.ts';

/** Raised for any refused or failed download; the message is safe to show. */
export class DownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DownloadError';
  }
}

/** The id goes into a signed path, so it must be exactly what uploads.ts mints. */
export const isUploadId = (id: string): boolean => /^[0-9a-f]{32}$/.test(id);

type PublicMeta = Omit<UploadMeta, 'tokenHash'>;

const sha256Hex = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex');

/** Per request (metadata, one chunk, or the delete); a chunk is at most 4 MB. */
const REQUEST_TIMEOUT_MS = 60_000;

async function signedFetch(
  fetchImpl: typeof fetch,
  origin: string,
  secret: string,
  method: 'GET' | 'DELETE',
  path: string,
  signal: AbortSignal,
): Promise<Response> {
  const ts = Date.now();
  const headers = {
    [TIMESTAMP_HEADER]: String(ts),
    [SIGNATURE_HEADER]: signRequest(secret, method, path, ts),
  };
  try {
    return await fetchImpl(new URL(path, origin).href, { method, headers, redirect: 'error', signal });
  } catch {
    throw new DownloadError('the upload store could not be reached');
  }
}

function isMeta(value: unknown): value is PublicMeta {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m['filename'] === 'string' &&
    typeof m['bytes'] === 'number' &&
    Number.isSafeInteger(m['bytes']) &&
    typeof m['chunkCount'] === 'number' &&
    Array.isArray(m['chunkSha256']) &&
    m['chunkSha256'].every((s) => typeof s === 'string') &&
    (m['browserSha256'] === null || m['browserSha256'] === undefined || typeof m['browserSha256'] === 'string') &&
    typeof m['state'] === 'string'
  );
}

export async function downloadUpload(
  origin: string,
  secret: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<{ filename: string; bytes: Buffer }> {
  if (!isUploadId(id)) throw new DownloadError('the upload id is not valid');
  const base = `/api/intake-download/${id}`;

  const metaRes = await signedFetch(fetchImpl, origin, secret, 'GET', `${base}/meta`, AbortSignal.timeout(timeoutMs));
  if (metaRes.status === 404) throw new DownloadError('upload not found');
  if (!metaRes.ok) throw new DownloadError(`the upload store answered HTTP ${metaRes.status} for the metadata`);
  let meta: unknown;
  try {
    meta = await metaRes.json();
  } catch {
    throw new DownloadError('the upload metadata was unreadable');
  }
  if (!isMeta(meta)) throw new DownloadError('the upload metadata was malformed');
  if (meta.state !== 'submitted') throw new DownloadError('upload is not in the submitted state');
  if (meta.bytes < 0 || meta.bytes > MAX_WEB_BYTES) throw new DownloadError('the upload size is out of range');
  if (meta.chunkSha256.length !== meta.chunkCount) throw new DownloadError('the upload metadata is inconsistent');

  const parts: Buffer[] = [];
  let total = 0;
  for (let n = 0; n < meta.chunkCount; n++) {
    // One signal covers the request and the body read, so a stalled stream is cut off too.
    const signal = AbortSignal.timeout(timeoutMs);
    const res = await signedFetch(fetchImpl, origin, secret, 'GET', `${base}/${n}`, signal);
    if (!res.ok) throw new DownloadError(`the upload store answered HTTP ${res.status} for chunk ${n}`);
    let chunk: Buffer;
    try {
      chunk = Buffer.from(await res.arrayBuffer());
    } catch {
      throw new DownloadError(`chunk ${n} could not be read from the upload store`);
    }
    if (sha256Hex(chunk) !== meta.chunkSha256[n]) throw new DownloadError(`chunk ${n} failed its checksum`);
    total += chunk.length;
    if (total > meta.bytes) throw new DownloadError('the upload is larger than recorded');
    parts.push(chunk);
  }
  if (total !== meta.bytes) throw new DownloadError('the upload is shorter than recorded');
  const bytes = Buffer.concat(parts, total);
  if (meta.browserSha256 && sha256Hex(bytes).toLowerCase() !== meta.browserSha256.toLowerCase()) {
    throw new DownloadError('the assembled upload failed the browser checksum');
  }
  return { filename: meta.filename, bytes };
}

export async function deleteRemoteUpload(
  origin: string,
  secret: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<void> {
  if (!isUploadId(id)) throw new DownloadError('the upload id is not valid');
  const res = await signedFetch(fetchImpl, origin, secret, 'DELETE', `/api/intake-download/${id}`, AbortSignal.timeout(timeoutMs));
  if (!res.ok) throw new DownloadError(`the upload store answered HTTP ${res.status} for the delete`);
}
