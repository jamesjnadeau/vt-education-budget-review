import { describe, expect, it } from 'vitest';

import {
  ALLOWED_EXTENSIONS,
  CHUNK_BYTES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  RETRIEVAL_METHODS,
  RETRIEVAL_METHOD_LABELS,
  chunkRanges,
  clientErrors,
  uploadFile,
  type FormState,
} from './contribute-upload.ts';

const MB = 1024 * 1024;

const linkForm = (over: Partial<FormState> = {}): FormState => ({
  hasUpload: false,
  uploading: false,
  documentUrl: 'https://district.example/budget.pdf',
  sourceUrl: 'https://district.example/budgets',
  retrievedDate: '2026-11-22',
  retrievalMethod: 'manual-download',
  note: '',
  fileName: null,
  fileBytes: null,
  ...over,
});
const fileForm = (over: Partial<FormState> = {}): FormState =>
  linkForm({ hasUpload: true, documentUrl: '', fileName: 'budget.pdf', fileBytes: 5 * MB, ...over });

describe('clientErrors', () => {
  it('accepts a complete link submission and a complete upload', () => {
    expect(clientErrors(linkForm())).toEqual([]);
    expect(clientErrors(fileForm())).toEqual([]);
  });

  it('flags a file and a link together, and neither', () => {
    expect(clientErrors(fileForm({ documentUrl: 'https://x.example/a.pdf' })).join(' ')).toMatch(/either a file or a link/);
    expect(clientErrors(linkForm({ documentUrl: '' })).join(' ')).toMatch(/Choose a file, or paste a link/);
  });

  it('flags an http:// link', () => {
    expect(clientErrors(linkForm({ documentUrl: 'http://x.example/a.pdf' })).join(' ')).toMatch(/https:\/\//);
  });

  it('needs a note when there is no web page, which email allows', () => {
    const noSource = { retrievalMethod: 'email', sourceUrl: '' };
    expect(clientErrors(fileForm(noSource)).join(' ')).toMatch(/note/);
    expect(clientErrors(fileForm({ ...noSource, note: 'Sent by the clerk on Nov 3' }))).toEqual([]);
  });

  it('needs a web page unless the method is email or in person', () => {
    expect(clientErrors(fileForm({ sourceUrl: '' })).join(' ')).toMatch(/web page you found it on/);
  });

  it('flags a bad date', () => {
    expect(clientErrors(fileForm({ retrievedDate: '' })).join(' ')).toMatch(/date/);
    expect(clientErrors(fileForm({ retrievedDate: '2026-02-30' })).join(' ')).toMatch(/date/);
  });

  it('flags a bad extension, an empty file and a file over 100 MB', () => {
    expect(clientErrors(fileForm({ fileName: 'setup.exe' })).join(' ')).toMatch(/must be one of/);
    expect(clientErrors(fileForm({ fileBytes: 0 })).join(' ')).toMatch(/empty/);
    expect(clientErrors(fileForm({ fileBytes: 101 * MB })).join(' ')).toMatch(/100 MB/);
  });

  it('blocks while a file is uploading', () => {
    expect(clientErrors(fileForm({ hasUpload: false, uploading: true })).join(' ')).toMatch(/wait/);
  });
});

describe('labels', () => {
  it('cover every enum value and the page offers the verbatim values', () => {
    expect(Object.keys(RETRIEVAL_METHOD_LABELS).sort()).toEqual([...RETRIEVAL_METHODS].sort());
    expect(Object.keys(DOCUMENT_TYPE_LABELS).sort()).toEqual([...DOCUMENT_TYPES].sort());
    expect(ALLOWED_EXTENSIONS).toContain('pdf');
  });
});

describe('chunkRanges', () => {
  it('splits into chunks with a short last one', () => {
    expect(chunkRanges(9 * MB, 4 * MB)).toEqual([
      [0, 4 * MB],
      [4 * MB, 8 * MB],
      [8 * MB, 9 * MB],
    ]);
  });
  it('is empty for an empty file', () => {
    expect(chunkRanges(0, 4 * MB)).toEqual([]);
  });
});

interface Call {
  url: string;
  method: string;
  auth: string | null;
  body: unknown;
}

function fakeServer(opts: { failPut?: (n: number, attempt: number) => Response | null } = {}) {
  const calls: Call[] = [];
  const attempts = new Map<string, number>();
  const impl = (async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    calls.push({ url, method: init.method ?? 'GET', auth: headers.get('authorization'), body: init.body });
    if (url.endsWith('/start')) return Response.json({ id: 'a'.repeat(32), token: 'secret-token', chunkBytes: CHUNK_BYTES, chunkCount: 3 });
    if (init.method === 'PUT') {
      const n = Number(url.split('/').pop());
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      const failure = opts.failPut?.(n, attempt) ?? null;
      if (failure) return failure;
    }
    return Response.json({ ok: true });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const nineMb = () => new File([new Uint8Array(9 * MB)], 'budget.pdf');

describe('uploadFile', () => {
  it('calls start, three PUTs in order, then done, and resolves to the id', async () => {
    const { calls, impl } = fakeServer();
    const progress: number[] = [];
    const id = await uploadFile(nineMb(), 'ts-token', { fetchImpl: impl, onProgress: (f) => progress.push(f) });
    expect(id).toBe('a'.repeat(32));
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST /api/intake-upload/start',
      `PUT /api/intake-upload/${id}/0`,
      `PUT /api/intake-upload/${id}/1`,
      `PUT /api/intake-upload/${id}/2`,
      `POST /api/intake-upload/${id}/done`,
    ]);
    expect(JSON.parse(calls[0]!.body as string)).toMatchObject({ filename: 'budget.pdf', bytes: 9 * MB, turnstileToken: 'ts-token' });
    expect(JSON.parse(calls[0]!.body as string).sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(calls.slice(1).every((c) => c.auth === 'Bearer secret-token')).toBe(true);
    expect(calls[0]!.auth).toBeNull();
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  it('retries a chunk that fails once', async () => {
    const { calls, impl } = fakeServer({ failPut: (n, attempt) => (n === 1 && attempt === 1 ? new Response('', { status: 502 }) : null) });
    await uploadFile(nineMb(), 't', { fetchImpl: impl, retryDelayMs: 0 });
    expect(calls.filter((c) => c.url.endsWith('/1'))).toHaveLength(2);
  });

  it('rejects with the server message once the retries are used up', async () => {
    const { calls, impl } = fakeServer({ failPut: () => Response.json({ error: 'Storage is having trouble.' }, { status: 500 }) });
    await expect(uploadFile(nineMb(), 't', { fetchImpl: impl, retryDelayMs: 0 })).rejects.toThrow('Storage is having trouble.');
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(4);
    expect(calls.some((c) => c.url.endsWith('/done'))).toBe(false);
  });

  it('does not retry a refusal, and shows the start message as-is', async () => {
    const refuse = (async () => Response.json({ error: 'The human check failed; please reload the page and try again.' }, { status: 403 })) as unknown as typeof fetch;
    await expect(uploadFile(nineMb(), 't', { fetchImpl: refuse })).rejects.toThrow('The human check failed; please reload the page and try again.');
  });
});
