/** GitHub App auth (RS256 JWT -> installation token) and repository_dispatch. */
import { createSign } from 'node:crypto';

import { DISPATCH_TYPE } from './limits.ts';
import type { WebIntakePayload } from './payload.ts';

const API = 'https://api.github.com';

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

export function appJwt(appId: string, privateKeyPem: string, nowSec: number): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iat: nowSec - 60, exp: nowSec + 540, iss: appId }));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKeyPem);
  return `${head}.${body}.${b64url(sig)}`;
}

function headers(bearer: string): Record<string, string> {
  return {
    authorization: `Bearer ${bearer}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'vt-budget-web-intake',
  };
}

/** Error messages carry only the status and step, never credentials or bodies. */
export async function installationToken(
  repo: string,
  jwt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const inst = await fetchImpl(`${API}/repos/${repo}/installation`, { headers: headers(jwt) });
  if (!inst.ok) throw new Error(`GitHub installation lookup failed: ${inst.status}`);
  const { id } = (await inst.json()) as { id?: unknown };
  if (typeof id !== 'number') throw new Error('GitHub installation lookup returned no id');
  const res = await fetchImpl(`${API}/app/installations/${id}/access_tokens`, {
    method: 'POST',
    headers: headers(jwt),
  });
  if (!res.ok) throw new Error(`GitHub access token request failed: ${res.status}`);
  const { token } = (await res.json()) as { token?: unknown };
  if (typeof token !== 'string' || token === '') throw new Error('GitHub access token response had no token');
  return token;
}

export async function sendDispatch(
  repo: string,
  token: string,
  payload: WebIntakePayload,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(`${API}/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: { ...headers(token), 'content-type': 'application/json' },
    body: JSON.stringify({ event_type: DISPATCH_TYPE, client_payload: payload }),
  });
  if (!res.ok) throw new Error(`GitHub dispatch failed: ${res.status}`);
}
