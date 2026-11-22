/**
 * POST /api/intake-upload/:id/done   Authorization: Bearer <upload token>.
 *
 * See intake-upload-start.mts for the Netlify API points verified.
 */
import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

import { toBlobStore } from '../../tools/src/web-intake/store-adapter.ts';

import { STORE_NAME } from '../../tools/src/web-intake/limits.ts';
import { finishUpload } from '../../tools/src/web-intake/uploads.ts';

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export default async (req: Request, context: Context): Promise<Response> => {
  const token = /^Bearer (\S+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) return json(403, { error: 'Missing upload token.' });
  const id = context.params['id'];
  if (!id) return json(400, { error: 'Bad path.' });

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const blobs = toBlobStore(store);
  const out = await finishUpload(blobs, id, token);
  return out.ok ? json(200, { ok: true }) : json(out.status, { error: out.error });
};

export const config: Config = { path: '/api/intake-upload/:id/done', method: 'POST' };
