import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { appJwt, installationToken, sendDispatch } from './github-app.ts';
import { toDispatchPayload } from './payload.ts';

const b64 = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Record<string, unknown>;

describe('appJwt', () => {
  it('signs RS256 with iss, iat and a 600 s window', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const jwt = appJwt('12345', pem, 1000);
    const [h, p, s] = jwt.split('.') as [string, string, string];
    expect(b64(h)).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claims = b64(p);
    expect(claims.iss).toBe('12345');
    expect(claims.iat).toBe(940);
    expect((claims.exp as number) - (claims.iat as number)).toBe(600);
    const v = createVerify('RSA-SHA256').update(`${h}.${p}`);
    expect(v.verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });
});

describe('installationToken', () => {
  it('looks up the installation then mints a token', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Response.json(calls.length === 1 ? { id: 77 } : { token: 'ghs_x' }, { status: calls.length === 1 ? 200 : 201 });
    });
    const t = await installationToken('o/r', 'JWT', f as unknown as typeof fetch);
    expect(t).toBe('ghs_x');
    expect(calls[0]!.url).toBe('https://api.github.com/repos/o/r/installation');
    expect(calls[1]!.url).toBe('https://api.github.com/app/installations/77/access_tokens');
    expect(calls[1]!.init.method).toBe('POST');
    for (const c of calls) {
      const h = c.init.headers as Record<string, string>;
      expect(h.authorization).toBe('Bearer JWT');
      expect(h.accept).toBe('application/vnd.github+json');
    }
  });
  it('throws on failure without leaking the jwt', async () => {
    const f = vi.fn(async () => new Response('no', { status: 404 }));
    await expect(installationToken('o/r', 'SECRETJWT', f as unknown as typeof fetch)).rejects.toThrow(/404/);
    await expect(installationToken('o/r', 'SECRETJWT', f as unknown as typeof fetch)).rejects.not.toThrow(/SECRETJWT/);
  });
});

describe('sendDispatch', () => {
  const payload = toDispatchPayload('s1', { entity: 'e', fiscal_year: '2026' });
  it('posts event_type and client_payload', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), init: init ?? {} };
      return new Response(null, { status: 204 });
    });
    await sendDispatch('o/r', 'tok', payload, f as unknown as typeof fetch);
    expect(seen!.url).toBe('https://api.github.com/repos/o/r/dispatches');
    const h = seen!.init.headers as Record<string, string>;
    expect(h.authorization).toBe('Bearer tok');
    expect(h.accept).toBe('application/vnd.github+json');
    expect(JSON.parse(seen!.init.body as string)).toEqual({ event_type: 'web-intake', client_payload: payload });
  });
  it('throws on 422', async () => {
    const f = vi.fn(async () => new Response('bad', { status: 422 }));
    await expect(sendDispatch('o/r', 'tok', payload, f as unknown as typeof fetch)).rejects.toThrow(/422/);
  });
});
