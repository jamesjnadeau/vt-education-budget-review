/**
 * PUT /api/intake-upload/:id/:n   Authorization: Bearer <upload token>, raw body.
 *
 * See intake-upload-start.mts for the Netlify API points verified. `/:id/done`
 * (POST, intake-upload-done) overlaps this pattern only by path; the method
 * filter separates them, and a non-numeric :n is rejected here regardless.
 */
import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

import { toBlobStore } from '../../tools/src/web-intake/store-adapter.ts';

import { CHUNK_BYTES, STORE_NAME } from '../../tools/src/web-intake/limits.ts';
import { putChunk } from '../../tools/src/web-intake/uploads.ts';

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export default async (req: Request, context: Context): Promise<Response> => {
  const auth = req.headers.get('authorization') ?? '';
  const token = /^Bearer (\S+)$/.exec(auth)?.[1];
  if (!token) return json(403, { error: 'Missing upload token.' });
  const { id, n } = context.params;
  if (!id || !n || !/^[0-9]{1,6}$/.test(n)) return json(400, { error: 'Bad chunk path.' });
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > CHUNK_BYTES) return json(413, { error: 'Chunk is too large.' });

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const blobs = toBlobStore(store);
  const out = await putChunk(blobs, id, Number(n), token, new Uint8Array(await req.arrayBuffer()));
  return out.ok ? json(200, { ok: true }) : json(out.status, { error: out.error });
};

export const config: Config = { path: '/api/intake-upload/:id/:n', method: 'PUT' };
