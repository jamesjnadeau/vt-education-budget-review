/**
 * Fetches statute text from the Vermont Legislature site.
 *
 * legislature.vermont.gov presents only its leaf certificate and omits the
 * GlobalSign intermediate that signed it. Browsers repair this by following the
 * leaf's Authority Information Access extension to download the missing
 * certificate; Node does not do AIA chasing, so a plain fetch fails with
 * UNABLE_TO_VERIFY_LEAF_SIGNATURE.
 *
 * This module does the AIA repair itself. Verification stays FULL: the chain
 * must still terminate at a GlobalSign root already present in the system trust
 * store, and `rejectUnauthorized` is left at its default of true. The missing
 * link is supplied, not skipped.
 *
 * Never replace this with `rejectUnauthorized: false`. Statute text is the
 * authority for every published number on this site; fetching it over an
 * unauthenticated connection would mean we cannot say where a number came from,
 * which is the one thing this project exists to be able to say. See AGENT.md.
 */

import { Agent, get as httpsGet } from 'node:https';
import { get as httpGet } from 'node:http';
import { X509Certificate } from 'node:crypto';
import { rootCertificates } from 'node:tls';

/** From the leaf certificate's AIA extension, "CA Issuers - URI". */
const GLOBALSIGN_INTERMEDIATE_AIA = 'http://secure.globalsign.com/cacert/gsrsaovsslca2018.crt';

const USER_AGENT = 'vt-budget-pipeline statute citation verification';

function download(url: string, redirectsLeft = 5): Promise<{ status: number; body: Buffer }> {
  const getter = url.startsWith('https:') ? httpsGet : httpGet;
  return new Promise((resolve, reject) => {
    getter(url, { headers: { 'user-agent': USER_AGENT } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        resolve(download(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

let cachedAgent: Agent | null = null;

/**
 * An HTTPS agent that can verify legislature.vermont.gov, by supplying the
 * intermediate the server fails to send.
 */
export async function statuteAgent(): Promise<Agent> {
  if (cachedAgent) return cachedAgent;

  const { status, body } = await download(GLOBALSIGN_INTERMEDIATE_AIA);
  if (status !== 200) {
    throw new Error(
      `Could not download the GlobalSign intermediate from ${GLOBALSIGN_INTERMEDIATE_AIA} ` +
        `(HTTP ${status}). Without it the Legislature's certificate chain cannot be verified. ` +
        `Fetch the statute by hand rather than disabling verification -- see AGENT.md.`,
    );
  }

  const intermediate = new X509Certificate(body);
  cachedAgent = new Agent({
    ca: [...rootCertificates, intermediate.toString()],
    keepAlive: true,
  });
  return cachedAgent;
}

export interface StatutePage {
  readonly url: string;
  readonly status: number;
  readonly retrieved: string;
  readonly html: string;
  readonly text: string;
}

export async function fetchStatute(url: string): Promise<StatutePage> {
  const agent = await statuteAgent();
  const html = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    httpsGet(url, { agent, headers: { 'user-agent': USER_AGENT } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }),
      );
    }).on('error', reject);
  });

  return {
    url,
    status: html.status,
    retrieved: new Date().toISOString(),
    html: html.body,
    text: statuteText(html.body),
  };
}

/** Strips the page chrome down to the statute body. */
export function statuteText(html: string): string {
  const text = html
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

  const start = text.search(/§\s*\d{3,5}\./);
  const body = start >= 0 ? text.slice(start) : text;
  const end = body.search(
    /\n(Vermont General Assembly|Contact Us|Sitemap|Copyright|Website Feedback|State of Vermont)\b/,
  );
  return (end > 0 ? body.slice(0, end) : body).trim();
}
