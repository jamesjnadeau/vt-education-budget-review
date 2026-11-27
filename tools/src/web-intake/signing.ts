/** HMAC request signing between the Netlify functions and the intake endpoints. */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { SIGNATURE_WINDOW_MS } from './limits.ts';

export const TIMESTAMP_HEADER = 'x-intake-timestamp';
export const SIGNATURE_HEADER = 'x-intake-signature';

function mac(secret: string, method: string, path: string, timestamp: string): Buffer {
  return createHmac('sha256', secret).update(`${method.toUpperCase()}\n${path}\n${timestamp}`).digest();
}

export function signRequest(secret: string, method: string, path: string, timestampMs: number): string {
  if (secret === '') throw new Error('The signing secret is empty.');
  return mac(secret, method, path, String(timestampMs)).toString('hex');
}

/** Never throws: anything malformed, missing, stale or mismatched is `false`. */
export function verifyRequest(
  secret: string,
  method: string,
  path: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  nowMs: number,
): boolean {
  if (secret === '' || !Number.isFinite(nowMs)) return false;
  if (timestampHeader === null || signatureHeader === null) return false;
  if (!/^[0-9]{1,16}$/.test(timestampHeader)) return false;
  if (!/^[0-9a-f]+$/i.test(signatureHeader) || signatureHeader.length % 2 !== 0) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp)) return false;
  if (Math.abs(nowMs - timestamp) > SIGNATURE_WINDOW_MS) return false;

  const given = Buffer.from(signatureHeader, 'hex');
  const expected = mac(secret, method, path, timestampHeader);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
