import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

/** Raised for any refused or failed link fetch; the message is safe to show. */
export class LinkFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinkFetchError';
  }
}

export interface FetchLinkOptions {
  maxBytes: number;
  timeoutMs: number;
  lookup?: (host: string) => Promise<{ address: string }[]>;
  fetchImpl?: typeof fetch;
  maxRedirects?: number;
}

export interface FetchedLink {
  bytes: Buffer;
  finalUrl: string;
  contentType: string | null;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const V4_PRIVATE: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16],
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function isPrivateV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  return V4_PRIVATE.some(([base, bits]) => {
    const b = ipv4ToInt(base) as number;
    const size = 2 ** (32 - bits);
    return Math.floor(n / size) === Math.floor(b / size);
  });
}

/** Expand an IPv6 literal to eight 16-bit groups, or null if malformed. */
function expandV6(ip: string): number[] | null {
  let s = ip;
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  // Trailing dotted IPv4 becomes two hex groups.
  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = ipv4ToInt(tail);
    if (v4 === null) return null;
    s = `${s.slice(0, lastColon + 1)}${Math.floor(v4 / 65536).toString(16)}:${(v4 % 65536).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part === '' ? [] : part.split(':'));
  const head = toGroups(halves[0] ?? '');
  const rest = halves.length === 2 ? toGroups(halves[1] ?? '') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  const out = all.map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? parseInt(g, 16) : NaN));
  return out.length === 8 && out.every((g) => !Number.isNaN(g)) ? out : null;
}

const v4Of = (hi: number, lo: number): string => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

function isPrivateV6(ip: string): boolean {
  const g = expandV6(ip);
  if (!g) return true;
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g;
  const zeroTo = (n: number): boolean => g.slice(0, n).every((x) => x === 0);
  if (zeroTo(7) && (g7 === 0 || g7 === 1)) return true; // :: and ::1
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xffc0) === 0xfec0) return true; // fec0::/10 deprecated site-local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (zeroTo(5) && g5 === 0xffff) return isPrivateV4(v4Of(g6, g7)); // ::ffff:0:0/96 mapped
  if (zeroTo(6)) return true; // ::/96 deprecated IPv4-compatible
  if (g0 === 0x64 && g1 === 0xff9b) {
    // 64:ff9b::/96 NAT64 embeds a v4 address; 64:ff9b:1::/48 is local-use.
    if (g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return isPrivateV4(v4Of(g6, g7));
    return true;
  }
  if (g0 === 0x2002) return isPrivateV4(v4Of(g1, g2)); // 6to4 embeds a v4 address
  if (g0 === 0x2001 && (g1 === 0 || g1 === 0x0db8)) return true; // Teredo, documentation
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // 100::/64 discard
  return false;
}

/** True for loopback, link-local, private, multicast, reserved and unparseable addresses. */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateV4(ip);
  if (family === 6) return isPrivateV6(ip);
  return true;
}

const defaultLookup = (host: string) => dns.lookup(host, { all: true });

async function assertPublicHttps(
  url: URL,
  lookup: (host: string) => Promise<{ address: string }[]>,
): Promise<void> {
  if (url.protocol !== 'https:') throw new LinkFetchError('Only https links are accepted.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host);
  if (addresses.length === 0) throw new LinkFetchError('The link host did not resolve.');
  // Every address must be public, so a mixed public/private answer is refused.
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new LinkFetchError('The link points to a non-public address.');
  }
}

function overLimit(maxBytes: number): LinkFetchError {
  return new LinkFetchError(`The document is over the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`);
}

async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw overLimit(maxBytes);
      chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    }
  } catch (err) {
    await reader.cancel().catch(() => undefined);
    throw err;
  }
  return Buffer.concat(chunks, total);
}

/**
 * Download a document link safely. Each hop (including redirects) must be
 * https and resolve only to public addresses; the body is streamed under a hard
 * byte cap and the whole operation shares one timeout.
 *
 * Known gap, accepted: DNS may change between our lookup and fetch's own
 * resolution (DNS rebinding); we validate but cannot pin the connection address.
 */
export async function fetchLink(url: string, opts: FetchLinkOptions): Promise<FetchedLink> {
  const lookup = opts.lookup ?? defaultLookup;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRedirects = opts.maxRedirects ?? 5;
  const signal = AbortSignal.timeout(opts.timeoutMs);

  let current: URL;
  try {
    current = new URL(url);
  } catch {
    throw new LinkFetchError('The link is not a valid URL.');
  }

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      await assertPublicHttps(current, lookup);
      const res = await fetchImpl(current.href, { redirect: 'manual', signal });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        await res.body?.cancel().catch(() => undefined);
        if (!location) throw new LinkFetchError('The link redirected without a destination.');
        try {
          current = new URL(location, current);
        } catch {
          throw new LinkFetchError('The link redirected to an invalid URL.');
        }
        continue;
      }

      if (!res.ok) {
        await res.body?.cancel().catch(() => undefined);
        throw new LinkFetchError(`The link returned HTTP ${res.status}.`);
      }
      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > opts.maxBytes) {
        await res.body?.cancel().catch(() => undefined);
        throw overLimit(opts.maxBytes);
      }
      const bytes = await readCapped(res.body, opts.maxBytes);
      return { bytes, finalUrl: current.href, contentType: res.headers.get('content-type') };
    }
  } catch (err) {
    if (err instanceof LinkFetchError) throw err;
    if (signal.aborted) throw new LinkFetchError('The link took too long to download.');
    throw new LinkFetchError('The link could not be downloaded.');
  }
  throw new LinkFetchError('The link redirected too many times.');
}
