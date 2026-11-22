import { describe, it, expect } from 'vitest';
import { cfBeaconToken, CF_BEACON_TOKEN, posthogConfig } from './analytics.ts';

describe('posthogConfig', () => {
  const full = {
    PUBLIC_POSTHOG_ENABLED: '1',
    PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test',
    PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
  };

  it('returns the key and host when enabled and fully configured', () => {
    expect(posthogConfig(full)).toEqual({
      apiKey: 'phc_test',
      apiHost: 'https://us.i.posthog.com',
    });
  });

  it('returns null when the enable flag is unset, even with a token (local .env)', () => {
    expect(posthogConfig({ ...full, PUBLIC_POSTHOG_ENABLED: undefined })).toBeNull();
  });

  it('returns null for a truthy-but-not-"1" flag', () => {
    expect(posthogConfig({ ...full, PUBLIC_POSTHOG_ENABLED: 'true' })).toBeNull();
  });

  it('returns null when the token or host is missing or empty', () => {
    expect(posthogConfig({ ...full, PUBLIC_POSTHOG_PROJECT_TOKEN: undefined })).toBeNull();
    expect(posthogConfig({ ...full, PUBLIC_POSTHOG_HOST: '' })).toBeNull();
  });
});

describe('cfBeaconToken', () => {
  it('returns the beacon token when PUBLIC_CF_ANALYTICS is exactly "1"', () => {
    expect(cfBeaconToken({ PUBLIC_CF_ANALYTICS: '1' })).toBe(CF_BEACON_TOKEN);
  });

  it('returns null when the flag is unset', () => {
    expect(cfBeaconToken({})).toBeNull();
  });

  it('returns null when the flag is undefined', () => {
    expect(cfBeaconToken({ PUBLIC_CF_ANALYTICS: undefined })).toBeNull();
  });

  it('returns null for the string "0"', () => {
    expect(cfBeaconToken({ PUBLIC_CF_ANALYTICS: '0' })).toBeNull();
  });

  it('returns null for the empty string', () => {
    expect(cfBeaconToken({ PUBLIC_CF_ANALYTICS: '' })).toBeNull();
  });

  it('returns null for a truthy-but-not-"1" value like "true"', () => {
    expect(cfBeaconToken({ PUBLIC_CF_ANALYTICS: 'true' })).toBeNull();
  });

  it('exposes the exact public token', () => {
    expect(CF_BEACON_TOKEN).toBe('da8000ca451b4497b086e6a9c38b2f41');
  });
});
