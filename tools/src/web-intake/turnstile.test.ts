import { describe, expect, it, vi } from 'vitest';

import { verifyTurnstile } from './turnstile.ts';

const reply = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body)));

describe('verifyTurnstile', () => {
  it('is true when Cloudflare says success', async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile('tok', 's', '1.2.3.4', f as unknown as typeof fetch)).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.method).toBe('POST');
    const sent = new URLSearchParams(init.body as string);
    expect(sent.get('secret')).toBe('s');
    expect(sent.get('response')).toBe('tok');
    expect(sent.get('remoteip')).toBe('1.2.3.4');
  });

  it('is false when success is false', async () => {
    expect(await verifyTurnstile('tok', 's', null, reply({ success: false }) as unknown as typeof fetch)).toBe(false);
  });

  it('is false when success is not exactly true', async () => {
    expect(await verifyTurnstile('tok', 's', null, reply({ success: 'true' }) as unknown as typeof fetch)).toBe(false);
  });

  it('is false when fetch throws', async () => {
    const f = vi.fn(async () => {
      throw new Error('network');
    });
    expect(await verifyTurnstile('tok', 's', null, f as unknown as typeof fetch)).toBe(false);
  });

  it('is false for a null token without calling fetch', async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile(null, 's', null, f as unknown as typeof fetch)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});
