/**
 * Fetching one vermont.gov page or document onto disk.
 *
 * Agents kept reaching for a browser to read Vermont state sources -- statute
 * text, AOE guidance, budget PDFs -- which is slow, unciteable, and, for the
 * TLS-misconfigured Legislature site, actually harder than doing it right. This
 * module does it right once: it repairs that certificate chain (by reusing the
 * statute fetcher's agent), speaks a browser-like user agent so
 * education.vermont.gov serves us, and drops the bytes in a folder. See
 * AGENT.md, "Fetching from vermont.gov".
 *
 * The vermont.gov allowlist is enforced by the CLI, not here, so this module's
 * mechanics can be tested against a localhost server.
 */

/** True for `vermont.gov` or any `*.vermont.gov` host over http/https. */
export function isVermontGovUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'vermont.gov' || host.endsWith('.vermont.gov');
}

/** Whether a response's Content-Type is HTML (so we save extracted text). */
export function isHtmlResponse(contentType: string | null | undefined): boolean {
  return typeof contentType === 'string' && contentType.toLowerCase().includes('text/html');
}

/**
 * Strips an HTML page down to readable text: drops scripts and styles, turns
 * block-closing tags into line breaks, removes remaining tags, decodes the
 * entities Vermont sites actually emit, and trims each line. General-purpose --
 * unlike `statuteText`, it does not clip to a statute body.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&sect;/g, '§')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Replaces every character that is not a safe filename character with `_`, then
 * strips leading dots so the result can never be `.`, `..`, or a hidden file.
 * Collapses runs of `_` so a messy path does not become a wall of underscores.
 */
function sanitizeSegment(raw: string): string {
  const cleaned = raw
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '');
  return cleaned;
}

/**
 * The basename to write under the output folder. A document keeps the name the
 * site released it under (sanitized); an HTML page becomes a `host_path.txt`
 * slug so two pages from the same site do not collide. Never returns a name
 * containing a path separator or starting with a dot.
 */
export function savedFileName(finalUrl: string, isHtml: boolean): string {
  const parsed = new URL(finalUrl);
  const host = parsed.hostname.toLowerCase();
  const pathname = decodeURIComponent(parsed.pathname);

  if (isHtml) {
    const slug = sanitizeSegment(`${host}${pathname}`.replace(/\/+$/, ''));
    const base = slug === sanitizeSegment(host) || slug === '' ? `${host}_index` : slug;
    return `${sanitizeSegment(base)}.txt`;
  }

  const lastSegment = pathname.split('/').filter(Boolean).pop() ?? '';
  const name = sanitizeSegment(lastSegment);
  if (!name || !name.includes('.')) {
    return name ? `${name}.bin` : `${sanitizeSegment(host)}.bin`;
  }
  return name;
}
