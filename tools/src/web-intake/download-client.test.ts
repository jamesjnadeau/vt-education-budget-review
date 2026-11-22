import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { DownloadError, deleteRemoteUpload, downloadUpload } from './download-client.ts';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyRequest } from './signing.ts';

const SECRET = 's3cret';
const ID = 'a'.repeat(32);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

function server(chunks: Buffer[], over: Record<string, unknown> = {}) {
  const whole = Buffer.concat(chunks);
  const meta = {
    id: ID,
    filename: 'b.pdf',
    bytes: whole.length,
    chunkCount: chunks.length,
    browserSha256: sha(whole),
    chunkSha256: chunks.map(sha),
    createdAt: 1,
    submittedAt: 2,
    state: 'submitted',
    ...over,
  };
  const seen: { method: string; path: string; headers: Headers }[] = [];
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    seen.push({ method: init?.method ?? 'GET', path: url.pathname, headers: new Headers(init?.headers) });
    const tail = url.pathname.split('/').pop()!;
    if (tail === 'meta') return Response.json(meta);
    return new Response(new Uint8Array(chunks[Number(tail)]!));
  }) as unknown as typeof fetch;
  return { impl, seen, whole };
}

describe('downloadUpload', () => {
  it('reassembles chunks and verifies hashes', async () => {
    const s = server([Buffer.from('%PDF-1 aaa'), Buffer.from('bbb')]);
    const out = await downloadUpload('https://site.test', SECRET, ID, s.impl);
    expect(out.filename).toBe('b.pdf');
    expect(out.bytes.equals(s.whole)).toBe(true);
  });

  it('chunk hash mismatch throws', async () => {
    const s = server([Buffer.from('one'), Buffer.from('two')], { chunkSha256: [sha(Buffer.from('one')), 'f'.repeat(64)] });
    await expect(downloadUpload('https://site.test', SECRET, ID, s.impl)).rejects.toBeInstanceOf(DownloadError);
  });

  it('refuses meta not in submitted state', async () => {
    const s = server([Buffer.from('x')], { state: 'uploaded' });
    await expect(downloadUpload('https://site.test', SECRET, ID, s.impl)).rejects.toThrow(/submitted/);
  });

  it('wrong total size throws', async () => {
    const s = server([Buffer.from('xyz')], { bytes: 99 });
    await expect(downloadUpload('https://site.test', SECRET, ID, s.impl)).rejects.toBeInstanceOf(DownloadError);
  });

  it('missing upload reads as not found', async () => {
    const impl = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
    await expect(downloadUpload('https://site.test', SECRET, ID, impl)).rejects.toThrow('upload not found');
  });

  it('requests carry a signature the server verifies', async () => {
    const s = server([Buffer.from('abc')]);
    await downloadUpload('https://site.test', SECRET, ID, s.impl);
    await deleteRemoteUpload('https://site.test', SECRET, ID, s.impl);
    expect(s.seen).toHaveLength(3);
    for (const r of s.seen) {
      expect(
        verifyRequest(SECRET, r.method, r.path, r.headers.get(TIMESTAMP_HEADER), r.headers.get(SIGNATURE_HEADER), Date.now()),
      ).toBe(true);
    }
    expect(s.seen[2]).toMatchObject({ method: 'DELETE', path: `/api/intake-download/${ID}` });
  });
});
