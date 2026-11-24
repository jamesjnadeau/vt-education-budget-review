/**
 * The "my town" cookie: one first-party cookie holding the town slug the
 * resident picked, so a returning visitor on /my/ is taken back to their town
 * page. Holds only the slug, never any analytics identity.
 *
 * Serialization returns the string to assign to `document.cookie` (browser
 * APIs take the whole Set-Cookie-style string, not separate attributes), with
 * the attributes the design settled: Path=/, Max-Age one year, SameSite=Lax,
 * and Secure on https. Reading is strict — a slug that is not a real town, or
 * that fails to decode, is ignored so a stale or corrupt cookie can never
 * redirect a visitor anywhere or throw.
 */

export const COOKIE_NAME = 'my_town';

/** Full document.cookie value for setting the town cookie. */
export function serializeTownCookie(slug: string, secure: boolean): string {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(slug)}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** The remembered slug from a Cookie header, only when it still names a real town. */
export function readTownCookie(cookieHeader: string, validSlugs: ReadonlySet<string>): string | null {
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const rawName = part.slice(0, eq).trim();
    const rawValue = part.slice(eq + 1);
    if (rawName !== COOKIE_NAME || rawValue === undefined) continue;
    const decoded = (() => {
      try {
        return decodeURIComponent(rawValue.trim());
      } catch {
        return null;
      }
    })();
    if (decoded !== null && validSlugs.has(decoded)) return decoded;
  }
  return null;
}

/** Full document.cookie value for clearing the town cookie. */
export function clearTownCookie(secure: boolean): string {
  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** Whether a landing visitor should be auto-redirected to their remembered town. */
export function shouldRedirect(search: string, remembered: string | null): boolean {
  if (remembered === null) return false;
  if (/[?&]change=1(\b|$)/.test(search)) return false;
  return true;
}
