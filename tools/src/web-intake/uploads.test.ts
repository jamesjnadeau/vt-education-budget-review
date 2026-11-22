import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { PENDING_CAP_BYTES, CHUNK_BYTES, MAX_WEB_BYTES, ABANDONED_AFTER_MS, RETAIN_MS } from './limits.ts';
import {
  cleanup,
  deleteUpload,
  finishUpload,
  markSubmitted,
  putChunk,
  readMeta,
  startUpload,
  type BlobStore,
  type UploadMeta,
} from './uploads.ts';

function memoryStore(): BlobStore & { data: Map<string, { bytes: Uint8Array; metadata: Record<string, unknown> }> } {
  const data = new Map<string, { bytes: Uint8Array; metadata: Record<string, unknown> }>();
  const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
  return {
    data,
    async get(key) {
      const e = data.get(key);
      return e ? (e.bytes.slice().buffer as ArrayBuffer) : null;
    },
    async getJSON(key) {
      const e = data.get(key);
      return e ? JSON.parse(new TextDecoder().decode(e.bytes)) : null;
    },
    async getMetadata(key) {
      const e = data.get(key);
      return e ? { metadata: e.metadata } : null;
    },
    async set(key, bytes, o) {
      data.set(key, { bytes: new Uint8Array(bytes as Uint8Array).slice(), metadata: o?.metadata ?? {} });
    },
    async setJSON(key, v) {
      data.set(key, { bytes: enc(v), metadata: {} });
    },
    async delete(key) {
      data.delete(key);
    },
    async list({ prefix }) {
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
  };
}

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

async function begin(s: BlobStore, bytes: number, filename = 'budget.pdf') {
  const r = await startUpload(s, { filename, bytes }, NOW);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe('startUpload', () => {
  it('rejects a disallowed extension', async () => {
    const r = await startUpload(memoryStore(), { filename: 'x.exe', bytes: 10 }, NOW);
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects over 100 MB', async () => {
    const r = await startUpload(memoryStore(), { filename: 'x.pdf', bytes: MAX_WEB_BYTES + 1 }, NOW);
    expect(r).toMatchObject({ ok: false, status: 413 });
  });

  it('rejects non-positive or fractional sizes and a malformed sha256', async () => {
    const s = memoryStore();
    expect(await startUpload(s, { filename: 'x.pdf', bytes: 0 }, NOW)).toMatchObject({ ok: false, status: 400 });
    expect(await startUpload(s, { filename: 'x.pdf', bytes: 1.5 }, NOW)).toMatchObject({ ok: false, status: 400 });
    expect(await startUpload(s, { filename: 'x.pdf', bytes: 5, sha256: 'nope' }, NOW)).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses when the pending cap would be exceeded', async () => {
    const s = memoryStore();
    await s.setJSON('pending-bytes', PENDING_CAP_BYTES - 10);
    const r = await startUpload(s, { filename: 'x.pdf', bytes: 11 }, NOW);
    expect(r).toMatchObject({ ok: false, status: 507 });
    if (!r.ok) expect(r.error).toBe('Uploads are full right now; please paste a link instead or try again tomorrow.');
  });

  it('allows an upload that exactly fits the cap', async () => {
    const s = memoryStore();
    await s.setJSON('pending-bytes', PENDING_CAP_BYTES - 10);
    expect((await startUpload(s, { filename: 'x.pdf', bytes: 10 }, NOW)).ok).toBe(true);
  });

  it('issues ids and tokens of at least 128 bits that differ across calls', async () => {
    const s = memoryStore();
    const a = await begin(s, 5);
    const b = await begin(s, 5);
    expect(a.id.length).toBeGreaterThanOrEqual(32);
    expect(a.token.length).toBeGreaterThanOrEqual(22);
    expect(a.id).not.toBe(b.id);
    expect(a.token).not.toBe(b.token);
  });

  it('stores only the token hash and counts the bytes as pending', async () => {
    const s = memoryStore();
    const a = await begin(s, 5);
    const meta = (await readMeta(s, a.id)) as UploadMeta;
    expect(meta.state).toBe('open');
    expect(meta.tokenHash).toBe(createHash('sha256').update(a.token).digest('hex'));
    expect(JSON.stringify([...s.data.entries()].map(([k, v]) => [k, new TextDecoder().decode(v.bytes)]))).not.toContain(a.token);
    expect(await s.getJSON('pending-bytes')).toBe(5);
    expect(a.chunkBytes).toBe(CHUNK_BYTES);
  });
});

describe('putChunk', () => {
  it('refuses the wrong token', async () => {
    const s = memoryStore();
    const a = await begin(s, 5);
    expect(await putChunk(s, a.id, 0, 'wrong', new Uint8Array(5))).toMatchObject({ ok: false, status: 403 });
  });

  it('refuses an unknown upload', async () => {
    expect(await putChunk(memoryStore(), 'nope', 0, 't', new Uint8Array(5))).toMatchObject({ ok: false, status: 404 });
  });

  it('refuses an out-of-range index', async () => {
    const s = memoryStore();
    const a = await begin(s, 5);
    expect(await putChunk(s, a.id, 1, a.token, new Uint8Array(5))).toMatchObject({ ok: false, status: 400 });
    expect(await putChunk(s, a.id, -1, a.token, new Uint8Array(5))).toMatchObject({ ok: false, status: 400 });
    expect(await putChunk(s, a.id, 0.5, a.token, new Uint8Array(5))).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses a wrong chunk length', async () => {
    const s = memoryStore();
    const a = await begin(s, CHUNK_BYTES + 3);
    expect(await putChunk(s, a.id, 0, a.token, new Uint8Array(10))).toMatchObject({ ok: false, status: 400 });
    expect(await putChunk(s, a.id, 1, a.token, new Uint8Array(4))).toMatchObject({ ok: false, status: 400 });
    expect((await putChunk(s, a.id, 1, a.token, new Uint8Array(3))).ok).toBe(true);
  });

  it('is idempotent when the same chunk is re-sent', async () => {
    const s = memoryStore();
    const a = await begin(s, 3);
    await putChunk(s, a.id, 0, a.token, new Uint8Array([1, 2, 3]));
    expect((await putChunk(s, a.id, 0, a.token, new Uint8Array([4, 5, 6]))).ok).toBe(true);
    expect(new Uint8Array((await s.get(`chunk/${a.id}/0`, { type: 'arrayBuffer' })) as ArrayBuffer)).toEqual(new Uint8Array([4, 5, 6]));
  });

  it('is refused after done, leaving the stored bytes unchanged', async () => {
    const s = memoryStore();
    const a = await begin(s, 3);
    await putChunk(s, a.id, 0, a.token, new Uint8Array([1, 2, 3]));
    expect((await finishUpload(s, a.id, a.token)).ok).toBe(true);
    const r = await putChunk(s, a.id, 0, a.token, new Uint8Array([9, 9, 9]));
    expect(r.ok).toBe(false);
    expect(new Uint8Array((await s.get(`chunk/${a.id}/0`, { type: 'arrayBuffer' })) as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe('finishUpload', () => {
  it('fails with 409 when a chunk is missing', async () => {
    const s = memoryStore();
    const a = await begin(s, CHUNK_BYTES + 3);
    await putChunk(s, a.id, 0, a.token, new Uint8Array(CHUNK_BYTES));
    expect(await finishUpload(s, a.id, a.token)).toMatchObject({ ok: false, status: 409 });
  });

  it('refuses the wrong token', async () => {
    const s = memoryStore();
    const a = await begin(s, 3);
    await putChunk(s, a.id, 0, a.token, new Uint8Array(3));
    expect(await finishUpload(s, a.id, 'wrong')).toMatchObject({ ok: false, status: 403 });
  });

  it('records chunk hashes, flips state and drops the token hash', async () => {
    const s = memoryStore();
    const a = await begin(s, CHUNK_BYTES + 3);
    const c0 = new Uint8Array(CHUNK_BYTES).fill(7);
    const c1 = new Uint8Array([1, 2, 3]);
    await putChunk(s, a.id, 0, a.token, c0);
    await putChunk(s, a.id, 1, a.token, c1);
    expect((await finishUpload(s, a.id, a.token)).ok).toBe(true);
    const meta = (await readMeta(s, a.id)) as UploadMeta;
    expect(meta.chunkSha256).toEqual([sha(c0), sha(c1)]);
    expect(meta.state).toBe('uploaded');
    expect(meta.tokenHash).toBeNull();
  });
});

describe('markSubmitted', () => {
  it('works once, then fails', async () => {
    const s = memoryStore();
    const a = await begin(s, 3);
    await putChunk(s, a.id, 0, a.token, new Uint8Array(3));
    await finishUpload(s, a.id, a.token);
    expect((await markSubmitted(s, a.id, NOW + 5)).ok).toBe(true);
    expect(await markSubmitted(s, a.id, NOW + 6)).toMatchObject({ ok: false });
    expect(((await readMeta(s, a.id)) as UploadMeta).submittedAt).toBe(NOW + 5);
  });

  it('refuses an upload that is not yet uploaded', async () => {
    const s = memoryStore();
    const a = await begin(s, 3);
    expect(await markSubmitted(s, a.id, NOW)).toMatchObject({ ok: false, status: 409 });
  });
});

describe('deleteUpload', () => {
  it('removes chunks and meta and subtracts pending bytes', async () => {
    const s = memoryStore();
    const a = await begin(s, 3);
    await begin(s, 4);
    await putChunk(s, a.id, 0, a.token, new Uint8Array(3));
    await deleteUpload(s, a.id);
    expect(await readMeta(s, a.id)).toBeNull();
    expect([...s.data.keys()].some((k) => k.includes(a.id))).toBe(false);
    expect(await s.getJSON('pending-bytes')).toBe(4);
  });
});

describe('cleanup', () => {
  async function seed(s: BlobStore, state: UploadMeta['state'], ageMs: number, bytes: number) {
    const r = await begin(s, bytes);
    await putChunk(s, r.id, 0, r.token, new Uint8Array(bytes));
    if (state !== 'open') await finishUpload(s, r.id, r.token);
    const meta = (await readMeta(s, r.id)) as UploadMeta;
    const created = NOW - ageMs;
    await s.setJSON(`meta/${r.id}`, {
      ...meta,
      createdAt: created,
      state,
      submittedAt: state === 'submitted' ? created : null,
    });
    return r.id;
  }

  it('applies the 48 h and 14 d windows and recomputes pending bytes', async () => {
    const s = memoryStore();
    const old = await seed(s, 'uploaded', 49 * HOUR, 11);
    const fresh = await seed(s, 'uploaded', 47 * HOUR, 13);
    const oldSub = await seed(s, 'submitted', RETAIN_MS + 24 * HOUR, 17);
    const freshSub = await seed(s, 'submitted', RETAIN_MS - 24 * HOUR, 19);
    const out = await cleanup(s, NOW);
    expect(out.deleted.sort()).toEqual([old, oldSub].sort());
    expect(await readMeta(s, old)).toBeNull();
    expect(await readMeta(s, fresh)).not.toBeNull();
    expect(await readMeta(s, oldSub)).toBeNull();
    expect(await readMeta(s, freshSub)).not.toBeNull();
    expect(out.pendingBytes).toBe(13 + 19);
    expect(await s.getJSON('pending-bytes')).toBe(13 + 19);
    expect(ABANDONED_AFTER_MS).toBe(48 * HOUR);
  });

  it('deletes an abandoned open upload and orphan chunks', async () => {
    const s = memoryStore();
    const open = await seed(s, 'open', 50 * HOUR, 5);
    await s.set('chunk/orphan/0', new Uint8Array(1));
    const out = await cleanup(s, NOW);
    expect(out.deleted).toEqual([open]);
    expect([...s.data.keys()].filter((k) => k.startsWith('chunk/'))).toEqual([]);
  });
});
