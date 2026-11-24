import { describe, expect, it } from 'vitest';
import {
  COOKIE_NAME,
  serializeTownCookie,
  readTownCookie,
  clearTownCookie,
  shouldRedirect,
} from './journey-cookie.ts';

describe('serializeTownCookie', () => {
  it('sets the cookie name and the town slug', () => {
    const s = serializeTownCookie('addison', false);
    expect(s).toContain(`${COOKIE_NAME}=addison`);
  });
  it('sets the attributes from the plan', () => {
    const s = serializeTownCookie('addison', false);
    expect(s).toContain('Path=/');
    expect(s).toContain('Max-Age=31536000');
    expect(s).toContain('SameSite=Lax');
  });
  it('adds Secure only when asked', () => {
    expect(serializeTownCookie('addison', true)).toContain('Secure');
    expect(serializeTownCookie('addison', false)).not.toContain('Secure');
  });
});

describe('readTownCookie', () => {
  it('returns the slug when present and valid', () => {
    expect(readTownCookie('some=thing; my_town=addison; x=y', new Set(['addison']))).toBe('addison');
  });
  it('returns null for a value that is not a known town', () => {
    expect(readTownCookie('my_town=nope', new Set(['addison']))).toBeNull();
  });
  it('returns null when the cookie is absent', () => {
    expect(readTownCookie('a=b', new Set(['addison']))).toBeNull();
  });
  it('returns null for garbage that fails to decode, without throwing', () => {
    expect(() => readTownCookie('my_town=%E0%A4%A', new Set(['addison']))).not.toThrow();
    expect(readTownCookie('my_town=%E0%A4%A', new Set(['addison']))).toBeNull();
  });
});

describe('clearTownCookie', () => {
  it('expires the cookie immediately', () => {
    expect(clearTownCookie(false)).toContain('Max-Age=0');
    expect(clearTownCookie(true)).toContain('Secure');
  });
});

describe('shouldRedirect', () => {
  it('never redirects when change=1 is present', () => {
    expect(shouldRedirect('?change=1', 'addison')).toBe(false);
  });
  it('never redirects when no town is remembered', () => {
    expect(shouldRedirect('', null)).toBe(false);
    expect(shouldRedirect('?change=1', null)).toBe(false);
  });
  it('redirects when a town is remembered and no change flag', () => {
    expect(shouldRedirect('', 'addison')).toBe(true);
  });
});
