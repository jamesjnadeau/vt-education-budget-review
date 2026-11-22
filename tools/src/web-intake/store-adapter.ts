import type { Store } from '@netlify/blobs';

import type { BlobStore } from './uploads.ts';

/** Adapt a Netlify Blobs Store to the BlobStore subset uploads.ts uses. */
export function toBlobStore(store: Store): BlobStore {
  return {
    get: (key, o) => store.get(key, o),
    getJSON: (key) => store.get(key, { type: 'json' }),
    getMetadata: async (key) => {
      const r = await store.getMetadata(key);
      return r === null ? null : { metadata: r.metadata };
    },
    set: async (key, data, o) => {
      // Store.set wants an ArrayBuffer-compatible value; copy a Uint8Array view out.
      const buf = data instanceof Uint8Array ? (data.slice().buffer as ArrayBuffer) : data;
      await store.set(key, buf, o);
    },
    setJSON: async (key, data) => {
      await store.setJSON(key, data);
    },
    delete: (key) => store.delete(key),
    list: async (o) => {
      const { blobs } = await store.list({ prefix: o.prefix });
      return { blobs: blobs.map((b) => ({ key: b.key })) };
    },
  };
}
