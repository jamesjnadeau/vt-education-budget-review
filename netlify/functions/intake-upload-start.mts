/**
 * POST /api/intake-upload/start  { filename, bytes, sha256, turnstileToken }
 *
 * Verified against the installed packages (@netlify/functions 6.1.1,
 * @netlify/blobs 10.7.13) at implementation time:
 * - `config.path` takes `/segment/:param` patterns and `config.method` takes a
 *   method or array; `context.params` carries the `:param` values (Context from
 *   @netlify/types), `context.ip` the client address.
 * - `Store.getMetadata()` resolves `{ etag, metadata } | null`, a superset of
 *   the BlobStore subset in uploads.ts.
 * - The `../../tools/src/...ts` imports are bundled by esbuild like any
 *   relative import (netlify.toml sets node_bundler = "esbuild").
 *
 * Fails closed: without TURNSTILE_SECRET_KEY the function answers 500.
 */
import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

import { toBlobStore } from '../../tools/src/web-intake/store-adapter.ts';

import { STORE_NAME } from '../../tools/src/web-intake/limits.ts';
import { verifyTurnstile } from '../../tools/src/web-intake/turnstile.ts';
import { startUpload } from '../../tools/src/web-intake/uploads.ts';

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export default async (req: Request, context: Context): Promise<Response> => {
  const secret = process.env['TURNSTILE_SECRET_KEY'];
  if (!secret) return json(500, { error: 'Uploads are not configured.' });

  let body: { filename?: unknown; bytes?: unknown; sha256?: unknown; turnstileToken?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'The request body must be JSON.' });
  }
  if (typeof body !== 'object' || body === null) return json(400, { error: 'The request body must be JSON.' });

  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : null;
  if (!(await verifyTurnstile(token, secret, context.ip ?? null))) {
    return json(403, { error: 'The human check failed; please reload the page and try again.' });
  }
  if (typeof body.filename !== 'string' || typeof body.bytes !== 'number') {
    return json(400, { error: 'filename and bytes are required.' });
  }
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const blobs = toBlobStore(store);
  const out = await startUpload(
    blobs,
    {
      filename: body.filename,
      bytes: body.bytes,
      ...(typeof body.sha256 === 'string' ? { sha256: body.sha256 } : {}),
    },
    Date.now(),
  );
  return out.ok ? json(200, out.value) : json(out.status, { error: out.error });
};

export const config: Config = { path: '/api/intake-upload/start', method: 'POST' };
