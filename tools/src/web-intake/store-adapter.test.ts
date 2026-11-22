import type { Store } from '@netlify/blobs';
import { describe, expect, it, vi } from 'vitest';

import { toBlobStore } from './store-adapter.ts';

function fakeStore() {
  const calls: Record<string, unknown[][]> = {};
  const rec = <T>(name: string, result: T) =>
    vi.fn(async (...args: unknown[]) => {
      (calls[name] ??= []).push(args);
      return result;
    });
  const store = {
    get: rec('get', 'value'),
    getMetadata: vi.fn(async (...args: unknown[]) => {
      (calls['getMetadata'] ??= []).push(args);
      return calls['meta-null'] ? null : { etag: 'e', metadata: { a: 1 } };
    }),
    set: rec('set', undefined),
    setJSON: rec('setJSON', undefined),
    delete: rec('delete', undefined),
    list: rec('list', { blobs: [{ key: 'k1', etag: 'x' }, { key: 'k2', etag: 'y' }], directories: [] }),
  };
  return { store: store as unknown as Store, calls };
}

describe('toBlobStore', () => {
  it('get passes the options through', async () => {
    const { store, calls } = fakeStore();
    await toBlobStore(store).get('k', { type: 'arrayBuffer' });
    expect(calls['get']![0]).toEqual(['k', { type: 'arrayBuffer' }]);
  });

  it('getJSON asks the store for type json', async () => {
    const { store, calls } = fakeStore();
    await toBlobStore(store).getJSON('k');
    expect(calls['get']![0]).toEqual(['k', { type: 'json' }]);
  });

  it('getMetadata keeps only the metadata, and maps a missing blob to null', async () => {
    const a = fakeStore();
    expect(await toBlobStore(a.store).getMetadata('k')).toEqual({ metadata: { a: 1 } });
    const b = fakeStore();
    b.calls['meta-null'] = [];
    expect(await toBlobStore(b.store).getMetadata('k')).toBeNull();
  });

  it('set copies exactly the bytes of a Buffer view, not its backing pool', async () => {
    const { store, calls } = fakeStore();
    const pool = Buffer.from('xxxxHELLOyyyy');
    const view = pool.subarray(4, 9);
    await toBlobStore(store).set('k', view, { metadata: { m: 1 } });
    const [key, sent, opts] = calls['set']![0] as [string, ArrayBuffer, unknown];
    expect(key).toBe('k');
    expect(sent).toBeInstanceOf(ArrayBuffer);
    expect(Buffer.from(sent).toString()).toBe('HELLO');
    expect(opts).toEqual({ metadata: { m: 1 } });
  });

  it('set passes an ArrayBuffer through untouched', async () => {
    const { store, calls } = fakeStore();
    const ab = new Uint8Array([1, 2, 3]).buffer;
    await toBlobStore(store).set('k', ab);
    expect((calls['set']![0] as unknown[])[1]).toBe(ab);
  });

  it('setJSON, delete and list adapt the store calls', async () => {
    const { store, calls } = fakeStore();
    const b = toBlobStore(store);
    await b.setJSON('k', { n: 1 });
    await b.delete('k');
    expect(await b.list({ prefix: 'p/' })).toEqual({ blobs: [{ key: 'k1' }, { key: 'k2' }] });
    expect(calls['setJSON']![0]).toEqual(['k', { n: 1 }]);
    expect(calls['delete']![0]).toEqual(['k']);
    expect(calls['list']![0]).toEqual([{ prefix: 'p/' }]);
  });
});
