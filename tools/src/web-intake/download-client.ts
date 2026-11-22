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

type PublicMeta = Omit<UploadMeta, 'tokenHash'>;

const sha256Hex = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex');

async function signedFetch(
  fetchImpl: typeof fetch,
  origin: string,
  secret: string,
  method: 'GET' | 'DELETE',
  path: string,
): Promise<Response> {
  const ts = Date.now();
  const headers = {
    [TIMESTAMP_HEADER]: String(ts),
    [SIGNATURE_HEADER]: signRequest(secret, method, path, ts),
  };
  try {
    return await fetchImpl(new URL(path, origin).href, { method, headers, redirect: 'error' });
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
    typeof m['state'] === 'string'
  );
}

export async function downloadUpload(
  origin: string,
  secret: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ filename: string; bytes: Buffer }> {
  const base = `/api/intake-download/${id}`;

  const metaRes = await signedFetch(fetchImpl, origin, secret, 'GET', `${base}/meta`);
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
    const res = await signedFetch(fetchImpl, origin, secret, 'GET', `${base}/${n}`);
    if (!res.ok) throw new DownloadError(`the upload store answered HTTP ${res.status} for chunk ${n}`);
    const chunk = Buffer.from(await res.arrayBuffer());
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
): Promise<void> {
  const res = await signedFetch(fetchImpl, origin, secret, 'DELETE', `/api/intake-download/${id}`);
  if (!res.ok) throw new DownloadError(`the upload store answered HTTP ${res.status} for the delete`);
}
