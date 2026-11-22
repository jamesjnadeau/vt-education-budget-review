/** Shared limits and names for the Netlify web intake. */

/** Largest document the web form accepts. */
export const MAX_WEB_BYTES = 100 * 1024 * 1024;
/** Size of each uploaded chunk. */
export const CHUNK_BYTES = 4 * 1024 * 1024;
/** Total bytes of not-yet-dispatched uploads the store may hold. */
export const PENDING_CAP_BYTES = 1024 ** 3;
/** An upload untouched this long is considered abandoned. */
export const ABANDONED_AFTER_MS = 48 * 60 * 60 * 1000;
/** How long a dispatched upload is retained. */
export const RETAIN_MS = 14 * 24 * 60 * 60 * 1000;
/** How far a signed request's timestamp may drift. */
export const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

/**
 * The repository that receives the dispatch. Not secret. netlify.toml's
 * [build.environment] is build-time only and invisible to functions, so the
 * function falls back to this when GITHUB_REPOSITORY is not set at runtime.
 */
export const DEFAULT_REPOSITORY = 'jamesjnadeau/vt-education-budget-review';

export function repositoryFrom(env: Record<string, string | undefined>): string {
  const v = env['GITHUB_REPOSITORY'];
  return v !== undefined && v !== '' ? v : DEFAULT_REPOSITORY;
}

export const STORE_NAME = "intake-uploads";
export const FORM_NAME = "budget-intake";
export const DISPATCH_TYPE = "web-intake";
