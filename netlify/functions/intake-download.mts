/**
 * GET    /api/intake-download/:id/meta   upload metadata (no tokenHash)
 * GET    /api/intake-download/:id/:n     chunk bytes
 * DELETE /api/intake-download/:id        remove the upload
 *
 * Every request must carry a valid HMAC (INTAKE_DOWNLOAD_SECRET, see
 * tools/src/web-intake/signing.ts). This is the only route that serves
 * uploaded bytes. Fails closed: without the secret the function answers 500 and
 * verifyRequest is never called.
 *
 * One function handles all three routes: config.path takes an array, and
 * `/:id/meta` and `/:id/:n` overlap, so the handler dispatches on the parsed
 * pathname.
 * See intake-upload-start.mts for the other Netlify API points verified.
 */
import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

import { toBlobStore } from '../../tools/src/web-intake/store-adapter.ts';

import { STORE_NAME } from '../../tools/src/web-intake/limits.ts';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyRequest } from '../../tools/src/web-intake/signing.ts';
import { deleteUpload, readMeta } from '../../tools/src/web-intake/uploads.ts';

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export default async (req: Request): Promise<Response> => {
  const secret = process.env['INTAKE_DOWNLOAD_SECRET'];
  if (!secret) return json(500, { error: 'Downloads are not configured.' });

  const url = new URL(req.url);
  if (
    !verifyRequest(
      secret,
      req.method,
      url.pathname,
      req.headers.get(TIMESTAMP_HEADER),
      req.headers.get(SIGNATURE_HEADER),
      Date.now(),
    )
  ) {
    return json(403, { error: 'Forbidden.' });
  }

  const m = /^\/api\/intake-download\/([0-9a-f]{32})(?:\/([^/]+))?\/?$/.exec(url.pathname);
  if (!m) return json(404, { error: 'Not found.' });
  const id = m[1] as string;
  const part = m[2];
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const blobs = toBlobStore(store);

  if (req.method === 'DELETE' && part === undefined) {
    await deleteUpload(blobs, id);
    return json(200, { ok: true });
  }
  if (req.method !== 'GET' || part === undefined) return json(405, { error: 'Method not allowed.' });

  const meta = await readMeta(blobs, id);
  if (!meta || meta.state === 'open') return json(404, { error: 'Not found.' });

  if (part === 'meta') {
    const { tokenHash: _omit, ...publicMeta } = meta;
    return json(200, publicMeta);
  }
  if (!/^[0-9]{1,6}$/.test(part) || Number(part) >= meta.chunkCount) return json(404, { error: 'Not found.' });
  const bytes = await store.get(`chunk/${id}/${Number(part)}`, { type: 'arrayBuffer' });
  if (!bytes) return json(404, { error: 'Not found.' });
  return new Response(bytes, {
    status: 200,
    headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' },
  });
};

export const config: Config = {
  path: ['/api/intake-download/:id/meta', '/api/intake-download/:id/:n', '/api/intake-download/:id'],
  method: ['GET', 'DELETE'],
};
