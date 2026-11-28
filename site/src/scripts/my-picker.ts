/**
 * Picker behaviour for /my/: remember the chosen town in a cookie, send the
 * town_selected event, and take the visitor to their town page. Also, on
 * landing with a remembered town and no change flag, go straight to that town
 * (the returning-visitor redirect) — which sends nothing.
 *
 * posthog is absent in dev and previews; the optional chain on capture() is
 * what keeps this safe there.
 */
import { buildTownSelected } from '../lib/journey-event.ts';
import { DEFAULT_YEAR, myHref } from '../lib/years.ts';
import { readTownCookie, serializeTownCookie, shouldRedirect } from '../lib/journey-cookie.ts';

declare global {
  interface Window {
    posthog?: { capture: (event: string, properties?: unknown) => void };
  }
}

interface PickerOptions {
  /** Select the valid town slugs directly rather than trusting any cookie. */
  validSlugs?: string[];
}

export function initPicker(options: PickerOptions): void {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const secure = window.location.protocol === 'https:';

  // The town select carries the authoritative list of valid slugs; when the
  // caller passes none, read them off the rendered options so the cookie
  // check is always against real towns, never a stale or garbage value.
  const form = document.querySelector<HTMLFormElement>('[data-my-picker]');
  const select = form?.querySelector<HTMLSelectElement>('select[name="town"]') ?? null;
  const valid = options.validSlugs
    ? new Set(options.validSlugs)
    : new Set([...(select?.options ?? [])].map((o) => o.value).filter(Boolean));

  // Returning visitor: if they remembered a town and did not ask to change it,
  // take them there without firing anything (this is not a pick).
  if (shouldRedirect(window.location.search, readTownCookie(document.cookie, valid))) {
    const slug = readTownCookie(document.cookie, valid);
    if (slug) {
      window.location.replace(`${base}${myHref(DEFAULT_YEAR, 'town', slug)}`);
      return;
    }
  }

  if (!form || !select) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const slug = select.value;
    if (!slug || !valid.has(slug)) return;

    document.cookie = serializeTownCookie(slug, secure);
    const captured = buildTownSelected(slug);
    window.posthog?.capture(captured.event, captured.properties);
    window.location.assign(`${base}${myHref(DEFAULT_YEAR, 'town', slug)}`);
  });
}
