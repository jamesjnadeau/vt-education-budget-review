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
