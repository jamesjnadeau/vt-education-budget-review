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

import { createHash } from 'node:crypto';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { statuteAgent } from '../statute/fetch.ts';

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
  let pathname: string;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    pathname = parsed.pathname;
  }

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

/** Browser-like so education.vermont.gov serves us; self-identifying. */
const USER_AGENT = 'Mozilla/5.0 (compatible; VT Budget bot)';

interface RawResponse {
  readonly finalUrl: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly body: Buffer;
}

/**
 * GETs a URL, following up to five redirects. Each hop must stay on the same
 * host as the one before it, or be a vermont.gov host itself; anything else is
 * refused rather than followed, so an open redirect or CDN hop cannot smuggle
 * the fetch off-domain. Exhausting the redirect budget rejects rather than
 * silently returning the last 3xx response. HTTPS requests go through the
 * statute agent, which supplies the intermediate certificate legislature.
 * vermont.gov omits; other vermont.gov hosts serve a complete chain and are
 * unaffected. Verification stays full -- see tools/src/statute/fetch.ts.
 */
async function fetchRaw(url: string, redirectsLeft = 5): Promise<RawResponse> {
  const isHttps = url.startsWith('https:');
  const agent = isHttps ? await statuteAgent() : undefined;
  const getter = isHttps ? httpsGet : httpGet;
  return new Promise<RawResponse>((resolve, reject) => {
    const options = agent
      ? { agent, headers: { 'user-agent': USER_AGENT } }
      : { headers: { 'user-agent': USER_AGENT } };
    getter(url, options, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error(`too many redirects fetching ${url}`));
          return;
        }
        const nextUrl = new URL(location, url);
        const currentHost = new URL(url).hostname;
        if (nextUrl.hostname !== currentHost && !isVermontGovUrl(nextUrl.toString())) {
          reject(new Error(`refused off-allowlist redirect to ${nextUrl.hostname} while fetching ${url}`));
          return;
        }
        resolve(fetchRaw(nextUrl.toString(), redirectsLeft - 1));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () =>
        resolve({
          finalUrl: url,
          status,
          contentType: (res.headers['content-type'] as string | undefined) ?? null,
          body: Buffer.concat(chunks),
        }),
      );
    }).on('error', reject);
  });
}

export interface FetchResult {
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly savedPath: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly kind: 'text' | 'raw';
}

/**
 * Fetches one URL into `outDir` and returns what landed. An HTML response is
 * saved as extracted text (`.txt`); anything else is saved as raw bytes under
 * its released name. The sha256 is of the bytes actually written, so it matches
 * the file on disk. Throws on any status >= 400 rather than saving an error
 * page. Does not enforce the vermont.gov allowlist -- the CLI does that.
 */
export async function fetchToFolder(url: string, outDir: string): Promise<FetchResult> {
  const res = await fetchRaw(url);
  if (res.status >= 400) {
    throw new Error(
      `HTTP ${res.status} fetching ${res.finalUrl}. Nothing was saved. If this is ` +
        `education.vermont.gov still refusing an automated client, fetch it by hand.`,
    );
  }

  const html = isHtmlResponse(res.contentType);
  const bytes = html ? Buffer.from(htmlToText(res.body.toString('utf8')), 'utf8') : res.body;

  mkdirSync(outDir, { recursive: true });
  const savedPath = join(outDir, savedFileName(res.finalUrl, html));
  writeFileSync(savedPath, bytes);

  return {
    requestedUrl: url,
    finalUrl: res.finalUrl,
    status: res.status,
    contentType: res.contentType,
    savedPath,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    kind: html ? 'text' : 'raw',
  };
}
