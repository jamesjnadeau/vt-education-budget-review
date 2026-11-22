import { describe, expect, it } from 'vitest';

import { SIGNATURE_WINDOW_MS } from './limits.ts';
import { signRequest, verifyRequest } from './signing.ts';

const NOW = 1_800_000_000_000;
const sig = signRequest('s3cret', 'post', '/api/x', NOW);

describe('signing', () => {
  it('round-trips', () => {
    expect(verifyRequest('s3cret', 'POST', '/api/x', String(NOW), sig, NOW)).toBe(true);
  });
  it('rejects altered path, method, secret, or timestamp', () => {
    expect(verifyRequest('s3cret', 'POST', '/api/y', String(NOW), sig, NOW)).toBe(false);
    expect(verifyRequest('s3cret', 'GET', '/api/x', String(NOW), sig, NOW)).toBe(false);
    expect(verifyRequest('other', 'POST', '/api/x', String(NOW), sig, NOW)).toBe(false);
    expect(verifyRequest('s3cret', 'POST', '/api/x', String(NOW + 1), sig, NOW)).toBe(false);
  });
  it('enforces the window in both directions', () => {
    expect(verifyRequest('s3cret', 'POST', '/api/x', String(NOW), sig, NOW + SIGNATURE_WINDOW_MS)).toBe(true);
    expect(verifyRequest('s3cret', 'POST', '/api/x', String(NOW), sig, NOW + SIGNATURE_WINDOW_MS + 1)).toBe(false);
    expect(verifyRequest('s3cret', 'POST', '/api/x', String(NOW), sig, NOW - SIGNATURE_WINDOW_MS - 1)).toBe(false);
  });
  it('returns false, never throws, on malformed input', () => {
    for (const [t, s] of [
      [null, sig],
      [String(NOW), null],
      ['abc', sig],
      ['1e12', sig],
      ['1.5', sig],
      [' 123', sig],
      ['', sig],
      [String(NOW), 'zz'],
      [String(NOW), 'abc'],
      [String(NOW), ''],
      [String(NOW), sig + sig],
      [String(NOW), sig.slice(0, -2)],
    ] as const) {
      expect(verifyRequest('s3cret', 'POST', '/api/x', t, s, NOW)).toBe(false);
    }
  });
});
