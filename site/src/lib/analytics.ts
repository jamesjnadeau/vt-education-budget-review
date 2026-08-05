// Cloudflare Web Analytics beacon token. Public by design -- it ships in the
// HTML to every visitor and identifies the site's analytics property, not a
// credential. Kept here rather than in env because only the on/off decision
// needs to vary between builds.
export const CF_BEACON_TOKEN = 'da8000ca451b4497b086e6a9c38b2f41';

// The beacon is emitted only when the build explicitly opts in via
// PUBLIC_CF_ANALYTICS === '1'. That flag is set exclusively by the Deploy
// workflow (merge to main -> GitHub Pages), so local dev, local builds and
// previews never phone home. Returns the token to emit, or null to omit the
// beacon entirely.
export function cfBeaconToken(env: Record<string, string | undefined>): string | null {
  return env.PUBLIC_CF_ANALYTICS === '1' ? CF_BEACON_TOKEN : null;
}
