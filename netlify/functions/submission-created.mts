/**
 * Netlify Forms `submission-created` event function (legacy handler form: the
 * event name is the file name, and it receives a HandlerEvent whose body is
 * JSON `{ payload: { form_name, id, data, ... } }`).
 *
 * API points: could NOT be verified against Netlify's docs offline. The
 * installed @netlify/types only models `FormSubmittedEvent` as `{ data }` (the
 * newer form), not this payload. Relied on from Netlify's documented shape:
 * `payload.form_name`, `payload.id`, `payload.data` (the submitted fields, plus
 * `ip`, `user_agent`, `referrer`). The client IP is read from `payload.data.ip`
 * with a fallback to top-level `payload.ip`; if neither exists the Turnstile
 * check simply runs without remoteip (Cloudflare treats it as optional).
 * Re-check against https://docs.netlify.com/manage/forms/notifications/ .
 *
 * Fails closed: missing config throws, so the function errors visibly rather
 * than skipping the captcha. Nothing sensitive (email, key, tokens) is logged.
 */
import type { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

import { appJwt, installationToken, sendDispatch } from '../../tools/src/web-intake/github-app.ts';
import { repositoryFrom, STORE_NAME } from '../../tools/src/web-intake/limits.ts';
import { handleSubmission } from '../../tools/src/web-intake/on-submission.ts';
import { toBlobStore } from '../../tools/src/web-intake/store-adapter.ts';
import { verifyTurnstile } from '../../tools/src/web-intake/turnstile.ts';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

export const handler: Handler = async (event) => {
  const appId = need('INTAKE_APP_ID');
  const privateKey = need('INTAKE_APP_PRIVATE_KEY').replace(/\\n/g, '\n');
  const repo = repositoryFrom(process.env);
  const secret = need('TURNSTILE_SECRET_KEY');

  const parsed = JSON.parse(event.body ?? '{}') as {
    payload?: { form_name?: unknown; id?: unknown; data?: unknown; ip?: unknown };
  };
  const p = parsed.payload;
  if (!p || typeof p.form_name !== 'string' || typeof p.id !== 'string') {
    throw new Error('Unrecognised submission-created payload');
  }
  const data = (typeof p.data === 'object' && p.data !== null ? p.data : {}) as Record<string, unknown>;
  const ipRaw = data['ip'] ?? p.ip;
  const remoteIp = typeof ipRaw === 'string' && ipRaw !== '' ? ipRaw : null;

  const now = Date.now();
  const outcome = await handleSubmission(
    { formName: p.form_name, submissionId: p.id, data, remoteIp },
    {
      store: toBlobStore(getStore({ name: STORE_NAME, consistency: 'strong' })),
      turnstileOk: (token, ip) => verifyTurnstile(token, secret, ip),
      dispatch: async (payload) => {
        const jwt = appJwt(appId, privateKey, Math.floor(now / 1000));
        const token = await installationToken(repo, jwt);
        await sendDispatch(repo, token, payload);
      },
      now,
    },
  );
  console.log(`web-intake: submission ${p.id} ${outcome}`);
  return { statusCode: 200 };
};
