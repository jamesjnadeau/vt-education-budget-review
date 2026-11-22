import { describe, expect, it } from 'vitest';
import { fetchLink, isPrivateAddress, LinkFetchError } from './fetch-link.ts';

const MB = 1024 * 1024;

const publicLookup = async () => [{ address: '93.184.216.34' }];

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

describe('isPrivateAddress', () => {
  it.each([
    '0.0.0.0',
    '127.0.0.1',
    '169.254.169.254',
    '10.1.2.3',
    '100.64.0.1',
    '172.31.0.1',
    '192.168.1.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fe80::1',
    'fd12:3456::1',
    '::ffff:192.168.0.1',
    '::ffff:7f00:1',
    '192.0.0.8',
    '192.0.2.1',
    '198.18.0.1',
    '198.19.255.255',
    '198.51.100.7',
    '203.0.113.9',
    'ff02::1',
    'fec0::1',
    '::8.8.8.8',
    '64:ff9b::7f00:1',
    '64:ff9b::a00:1',
    '64:ff9b:1::1',
    '2002:7f00:1::1',
    '2002:c0a8:101::',
    '2001::1',
    '2001:db8::1',
    '100::1',
  ])('treats %s as private', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '172.32.0.1', '100.128.0.1', '2606:4700::1111', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:808:808::1', '198.20.0.1', '2001:4860:4860::8888'])(
    'treats %s as public',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );

  it('treats a non-IP string as private', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true);
  });
});

describe('fetchLink', () => {
  const base = { maxBytes: 3 * MB, timeoutMs: 5000 };

  it('refuses http url', async () => {
    const fetchImpl = (async () => new Response('x')) as typeof fetch;
    await expect(
      fetchLink('http://example.com/a.pdf', { ...base, lookup: publicLookup, fetchImpl }),
    ).rejects.toBeInstanceOf(LinkFetchError);
  });

  it('refuses host resolving to private address', async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response('x');
    }) as typeof fetch;
    await expect(
      fetchLink('https://example.com/a.pdf', {
        ...base,
        lookup: async () => [{ address: '10.0.0.5' }],
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(LinkFetchError);
    expect(called).toBe(false);
  });

  it('refuses when any resolved address is private (mixed results)', async () => {
    const fetchImpl = (async () => new Response('x')) as typeof fetch;
    await expect(
      fetchLink('https://example.com/a.pdf', {
        ...base,
        lookup: async () => [{ address: '8.8.8.8' }, { address: '127.0.0.1' }],
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(LinkFetchError);
  });

  it('refuses a literal private IP host', async () => {
    const fetchImpl = (async () => new Response('x')) as typeof fetch;
    await expect(
      fetchLink('https://169.254.169.254/latest', { ...base, fetchImpl }),
    ).rejects.toBeInstanceOf(LinkFetchError);
  });

  it('refuses redirect to private address', async () => {
    const fetchImpl = (async () => redirect('https://internal.example/')) as typeof fetch;
    const lookup = async (host: string) =>
      host === 'internal.example' ? [{ address: '10.0.0.5' }] : [{ address: '93.184.216.34' }];
    await expect(
      fetchLink('https://example.com/a.pdf', { ...base, lookup, fetchImpl }),
    ).rejects.toBeInstanceOf(LinkFetchError);
  });

  it('refuses redirect to http', async () => {
    const fetchImpl = (async () => redirect('http://example.com/b.pdf')) as typeof fetch;
    await expect(
      fetchLink('https://example.com/a.pdf', { ...base, lookup: publicLookup, fetchImpl }),
    ).rejects.toBeInstanceOf(LinkFetchError);
  });

  it('refuses too many redirects', async () => {
    const fetchImpl = (async () => redirect('https://example.com/loop')) as typeof fetch;
    await expect(
      fetchLink('https://example.com/a.pdf', {
        ...base,
        lookup: publicLookup,
        fetchImpl,
        maxRedirects: 3,
      }),
    ).rejects.toThrow(/redirect/i);
  });

  it('aborts body over cap without content-length', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(MB));
      },
    });
    const fetchImpl = (async () => new Response(body)) as typeof fetch;
    await expect(
      fetchLink('https://example.com/a.pdf', { ...base, lookup: publicLookup, fetchImpl }),
    ).rejects.toThrow(/over the 3 MB limit/);
    expect(pulled).toBeLessThan(10);
  });

  it('rejects early when content-length exceeds the cap', async () => {
    const fetchImpl = (async () =>
      new Response('x', { headers: { 'content-length': String(10 * MB) } })) as typeof fetch;
    await expect(
      fetchLink('https://example.com/a.pdf', { ...base, lookup: publicLookup, fetchImpl }),
    ).rejects.toThrow(/over the 3 MB limit/);
  });

  it('rejects non-2xx responses', async () => {
    const fetchImpl = (async () => new Response('no', { status: 404 })) as typeof fetch;
    await expect(
      fetchLink('https://example.com/a.pdf', { ...base, lookup: publicLookup, fetchImpl }),
    ).rejects.toBeInstanceOf(LinkFetchError);
  });

  it('returns bytes, final url after a redirect, and content type', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const u = String(input);
      calls.push(u);
      if (u === 'https://example.com/a') return redirect('/b.pdf');
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'application/pdf' },
      });
    }) as typeof fetch;
    const result = await fetchLink('https://example.com/a', {
      ...base,
      lookup: publicLookup,
      fetchImpl,
    });
    expect(result.finalUrl).toBe('https://example.com/b.pdf');
    expect(result.contentType).toBe('application/pdf');
    expect([...result.bytes]).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(2);
  });
});
