/**
 * Chunked upload state machine over a blob store (Netlify Blobs in production,
 * an in-memory map in tests). Pure logic: the Netlify functions only parse the
 * request and call these.
 *
 * Keys: `meta/<id>` (UploadMeta JSON), `chunk/<id>/<n>` (raw bytes, metadata
 * `{ sha256, bytes }`), `pending-bytes` (JSON number).
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { ALLOWED_EXTENSIONS, extensionOf } from '../intake/security.ts';
import { ABANDONED_AFTER_MS, CHUNK_BYTES, MAX_WEB_BYTES, PENDING_CAP_BYTES, RETAIN_MS } from './limits.ts';

/** The subset of the @netlify/blobs Store this module uses. */
export interface BlobStore {
  get(key: string, o: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
  getJSON(key: string): Promise<unknown>;
  getMetadata(key: string): Promise<{ metadata: Record<string, unknown> } | null>;
  set(key: string, data: ArrayBuffer | Uint8Array, o?: { metadata?: Record<string, unknown> }): Promise<void>;
  setJSON(key: string, data: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(o: { prefix: string }): Promise<{ blobs: { key: string }[] }>;
}

export interface UploadMeta {
  id: string;
  filename: string;
  bytes: number;
  chunkCount: number;
  browserSha256: string | null;
  chunkSha256: string[];
  createdAt: number;
  submittedAt: number | null;
  state: 'open' | 'uploaded' | 'submitted';
  /** sha256 of the bearer token while open; null afterwards. The token itself is never stored. */
  tokenHash: string | null;
}

export type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 403 | 404 | 409 | 413 | 507; error: string };

const PENDING_KEY = 'pending-bytes';
const metaKey = (id: string) => `meta/${id}`;
const chunkKey = (id: string, n: number) => `chunk/${id}/${n}`;

const fail = (status: 400 | 403 | 404 | 409 | 413 | 507, error: string): { ok: false; status: typeof status; error: string } => ({
  ok: false,
  status,
  error,
});
const sha256Hex = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');

async function readPending(s: BlobStore): Promise<number> {
  const v = await s.getJSON(PENDING_KEY);
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

export async function readMeta(s: BlobStore, id: string): Promise<UploadMeta | null> {
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  const v = await s.getJSON(metaKey(id));
  return v === null || v === undefined ? null : (v as UploadMeta);
}

function tokenMatches(meta: UploadMeta, token: string): boolean {
  if (meta.tokenHash === null) return false;
  const given = Buffer.from(sha256Hex(token), 'hex');
  const stored = Buffer.from(meta.tokenHash, 'hex');
  return given.length === stored.length && timingSafeEqual(given, stored);
}

export async function startUpload(
  s: BlobStore,
  req: { filename: string; bytes: number; sha256?: string },
  now: number,
): Promise<Outcome<{ id: string; token: string; chunkBytes: number; chunkCount: number }>> {
  const ext = typeof req.filename === 'string' ? extensionOf(req.filename) : null;
  if (!ext || !(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return fail(400, `The file must end in one of ${ALLOWED_EXTENSIONS.join(', ')}.`);
  }
  if (req.filename.length > 255 || /[\x00-\x1f\x7f/\\]/.test(req.filename)) {
    return fail(400, 'The filename is not acceptable.');
  }
  if (!Number.isSafeInteger(req.bytes) || req.bytes <= 0) return fail(400, 'The file size is not valid.');
  if (req.bytes > MAX_WEB_BYTES) return fail(413, 'The file is larger than 100 MB; please paste a link instead.');
  if (req.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(req.sha256)) return fail(400, 'The checksum is not valid.');

  const pending = await readPending(s);
  if (pending + req.bytes > PENDING_CAP_BYTES) {
    return fail(507, 'Uploads are full right now; please paste a link instead or try again tomorrow.');
  }

  const id = randomBytes(16).toString('hex');
  const token = randomBytes(32).toString('base64url');
  const chunkCount = Math.ceil(req.bytes / CHUNK_BYTES);
  const meta: UploadMeta = {
    id,
    filename: req.filename,
    bytes: req.bytes,
    chunkCount,
    browserSha256: req.sha256 ?? null,
    chunkSha256: [],
    createdAt: now,
    submittedAt: null,
    state: 'open',
    tokenHash: sha256Hex(token),
  };
  await s.setJSON(metaKey(id), meta);
  // Read-modify-write: concurrent starts can lose an increment. The nightly
  // cleanup() recomputes the counter from the metas, which corrects any drift.
  await s.setJSON(PENDING_KEY, pending + req.bytes);
  return { ok: true, value: { id, token, chunkBytes: CHUNK_BYTES, chunkCount } };
}

function expectedChunkLength(meta: UploadMeta, n: number): number {
  return n < meta.chunkCount - 1 ? CHUNK_BYTES : meta.bytes - CHUNK_BYTES * (meta.chunkCount - 1);
}

export async function putChunk(
  s: BlobStore,
  id: string,
  n: number,
  token: string,
  body: Uint8Array,
): Promise<Outcome<null>> {
  const meta = await readMeta(s, id);
  if (!meta) return fail(404, 'No such upload.');
  if (meta.state !== 'open') return fail(409, 'This upload is already complete.');
  if (!tokenMatches(meta, token)) return fail(403, 'Not authorised for this upload.');
  if (!Number.isInteger(n) || n < 0 || n >= meta.chunkCount) return fail(400, 'Chunk index out of range.');
  if (body.byteLength !== expectedChunkLength(meta, n)) return fail(400, 'Chunk has the wrong length.');
  await s.set(chunkKey(id, n), body, { metadata: { sha256: sha256Hex(body), bytes: body.byteLength } });
  // Blobs has no compare-and-set, so a concurrent finishUpload can flip the
  // state between the check above and the write. Re-read after writing and back
  // the chunk out if the upload is no longer open. A residual window remains
  // (finish could still land between this re-read and the end of the request);
  // the consumer recomputes chunk hashes from the bytes, so a late write is
  // detected there rather than trusted via chunkSha256.
  const after = await readMeta(s, id);
  if (!after || after.state !== 'open') {
    await s.delete(chunkKey(id, n));
    return fail(409, 'This upload is already complete.');
  }
  return { ok: true, value: null };
}

export async function finishUpload(s: BlobStore, id: string, token: string): Promise<Outcome<null>> {
  const meta = await readMeta(s, id);
  if (!meta) return fail(404, 'No such upload.');
  if (meta.state !== 'open') return fail(409, 'This upload is already complete.');
  if (!tokenMatches(meta, token)) return fail(403, 'Not authorised for this upload.');
  const hashes: string[] = [];
  for (let n = 0; n < meta.chunkCount; n++) {
    const info = await s.getMetadata(chunkKey(id, n));
    const hash = info?.metadata['sha256'];
    if (!info || typeof hash !== 'string' || info.metadata['bytes'] !== expectedChunkLength(meta, n)) {
      return fail(409, `Chunk ${n} is missing or the wrong length.`);
    }
    hashes.push(hash);
  }
  await s.setJSON(metaKey(id), { ...meta, chunkSha256: hashes, state: 'uploaded', tokenHash: null } satisfies UploadMeta);
  return { ok: true, value: null };
}

export async function markSubmitted(s: BlobStore, id: string, now: number): Promise<Outcome<null>> {
  const meta = await readMeta(s, id);
  if (!meta) return fail(404, 'No such upload.');
  if (meta.state !== 'uploaded') return fail(409, 'The upload is not in the uploaded state.');
  await s.setJSON(metaKey(id), { ...meta, state: 'submitted', submittedAt: now } satisfies UploadMeta);
  return { ok: true, value: null };
}

async function removeBlobs(s: BlobStore, id: string): Promise<void> {
  const { blobs } = await s.list({ prefix: `chunk/${id}/` });
  for (const b of blobs) await s.delete(b.key);
  await s.delete(metaKey(id));
}

export async function deleteUpload(s: BlobStore, id: string): Promise<void> {
  const meta = await readMeta(s, id);
  await removeBlobs(s, id);
  if (meta) await s.setJSON(PENDING_KEY, Math.max(0, (await readPending(s)) - meta.bytes));
}

export async function cleanup(s: BlobStore, now: number): Promise<{ deleted: string[]; pendingBytes: number }> {
  const deleted: string[] = [];
  let pendingBytes = 0;
  const live = new Set<string>();
  for (const { key } of (await s.list({ prefix: 'meta/' })).blobs) {
    const meta = (await s.getJSON(key)) as UploadMeta | null;
    if (!meta) continue;
    const anchor = meta.state === 'submitted' ? (meta.submittedAt ?? meta.createdAt) : meta.createdAt;
    const expired =
      now - meta.createdAt > RETAIN_MS ||
      (meta.state === 'submitted' ? now - anchor > RETAIN_MS : now - meta.createdAt > ABANDONED_AFTER_MS);
    if (expired) {
      await removeBlobs(s, meta.id);
      deleted.push(meta.id);
    } else {
      live.add(meta.id);
      pendingBytes += meta.bytes;
    }
  }
  // Chunks whose meta is gone (an interrupted delete) are unreachable; drop them.
  for (const { key } of (await s.list({ prefix: 'chunk/' })).blobs) {
    if (!live.has(key.split('/')[1] ?? '')) await s.delete(key);
  }
  await s.setJSON(PENDING_KEY, pendingBytes);
  return { deleted, pendingBytes };
}
