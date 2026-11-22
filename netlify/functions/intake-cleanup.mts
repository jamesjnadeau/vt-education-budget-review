/**
 * Scheduled nightly: delete expired and abandoned uploads and recompute the
 * pending-bytes counter (cleanup() in tools/src/web-intake/uploads.ts).
 *
 * Verified against the installed @netlify/functions types: `config.schedule`
 * is a plain cron string (CronSchedule = string, so '@daily' type-checks) and
 * is mutually exclusive with `path`. The default export is the same
 * `(req: Request) => ...` fetch-style handler as the HTTP functions; it
 * returns nothing, which the type allows only for background handlers, so it
 * returns an empty 200 Response instead.
 *
 * Logs counts only: never upload ids or filenames.
 */
import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

import { toBlobStore } from '../../tools/src/web-intake/store-adapter.ts';

import { STORE_NAME } from '../../tools/src/web-intake/limits.ts';
import { cleanup } from '../../tools/src/web-intake/uploads.ts';

export default async (): Promise<Response> => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const { deleted, pendingBytes } = await cleanup(toBlobStore(store), Date.now());
  console.log(`intake-cleanup: deleted ${deleted.length} upload(s); ${pendingBytes} bytes pending`);
  return new Response(null, { status: 200 });
};

export const config: Config = { schedule: '@daily' };
