import { describe, expect, it } from 'vitest';

import { htmlToText, isHtmlResponse, isVermontGovUrl, savedFileName } from './vermont.ts';

describe('isVermontGovUrl', () => {
  it('accepts vermont.gov and its subdomains over http or https', () => {
    expect(isVermontGovUrl('https://legislature.vermont.gov/statutes/section/16/135/04001')).toBe(true);
    expect(isVermontGovUrl('https://education.vermont.gov/documents/budget.pdf')).toBe(true);
    expect(isVermontGovUrl('http://vermont.gov')).toBe(true);
    expect(isVermontGovUrl('https://VERMONT.GOV/thing')).toBe(true);
  });

  it('rejects lookalike and unrelated hosts', () => {
    expect(isVermontGovUrl('https://vermont.gov.evil.com/x')).toBe(false);
    expect(isVermontGovUrl('https://notvermont.gov/x')).toBe(false);
    expect(isVermontGovUrl('https://example.com/x')).toBe(false);
  });

  it('rejects non-web schemes and unparseable input', () => {
    expect(isVermontGovUrl('ftp://legislature.vermont.gov/x')).toBe(false);
    expect(isVermontGovUrl('file:///etc/passwd')).toBe(false);
    expect(isVermontGovUrl('not a url')).toBe(false);
  });
});

describe('isHtmlResponse', () => {
  it('is true only for an html content type', () => {
    expect(isHtmlResponse('text/html; charset=utf-8')).toBe(true);
    expect(isHtmlResponse('TEXT/HTML')).toBe(true);
    expect(isHtmlResponse('application/pdf')).toBe(false);
    expect(isHtmlResponse(null)).toBe(false);
    expect(isHtmlResponse(undefined)).toBe(false);
  });
});

describe('htmlToText', () => {
  it('strips tags, decodes entities, and collapses whitespace to lines', () => {
    const html = '<h1>Title</h1><p>One &amp; two.</p><style>.x{}</style><p>Three&nbsp;§4.</p>';
    expect(htmlToText(html)).toBe('Title\nOne & two.\nThree §4.');
  });

  it('drops script contents entirely', () => {
    expect(htmlToText('<p>keep</p><script>var x = 1 < 2;</script>')).toBe('keep');
  });
});

describe('savedFileName', () => {
  it('keeps a document basename and sanitizes it', () => {
    expect(savedFileName('https://education.vermont.gov/sites/aoe/files/FY24%20Budget.pdf', false)).toBe(
      'FY24_Budget.pdf',
    );
    expect(savedFileName('https://education.vermont.gov/a/b/report.xlsx', false)).toBe('report.xlsx');
  });

  it('never lets a document name climb out of the folder', () => {
    const name = savedFileName('https://x.vermont.gov/a/..', false);
    expect(name.includes('/')).toBe(false);
    expect(name.startsWith('.')).toBe(false);
    expect(name).not.toBe('..');
  });

  it('slugs an html page to a .txt name from host and path', () => {
    expect(savedFileName('https://legislature.vermont.gov/statutes/section/16/135/04001', true)).toBe(
      'legislature.vermont.gov_statutes_section_16_135_04001.txt',
    );
  });

  it('names an html root page by host', () => {
    expect(savedFileName('https://education.vermont.gov/', true)).toBe('education.vermont.gov_index.txt');
  });

  it('falls back to a host-based name when a document path has no basename', () => {
    expect(savedFileName('https://data.vermont.gov/', false)).toBe('data.vermont.gov.bin');
  });
});

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll } from 'vitest';

import { fetchToFolder } from './vermont.ts';

describe('fetchToFolder (integration, localhost)', () => {
  const PDF_BYTES = Buffer.from('%PDF-1.7\nhello vermont\n');
  let baseUrl = '';
  const server = createServer((req, res) => {
    if (req.url === '/page') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h1>Budget</h1><p>Line one.</p>');
    } else if (req.url === '/files/report.pdf') {
      res.writeHead(200, { 'content-type': 'application/pdf' });
      res.end(PDF_BYTES);
    } else if (req.url === '/missing') {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('nope');
    } else {
      res.writeHead(500);
      res.end();
    }
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('saves an html page as extracted .txt with a matching sha256', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vtfetch-'));
    const result = await fetchToFolder(`${baseUrl}/page`, dir);
    expect(result.kind).toBe('text');
    expect(result.status).toBe(200);
    const onDisk = readFileSync(result.savedPath, 'utf8');
    expect(onDisk).toBe('Budget\nLine one.');
    expect(result.sha256).toBe(createHash('sha256').update(onDisk).digest('hex'));
  });

  it('saves a document as raw bytes, unchanged', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vtfetch-'));
    const result = await fetchToFolder(`${baseUrl}/files/report.pdf`, dir);
    expect(result.kind).toBe('raw');
    expect(result.savedPath.endsWith('report.pdf')).toBe(true);
    expect(readFileSync(result.savedPath).equals(PDF_BYTES)).toBe(true);
  });

  it('throws on an http error status without writing a file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vtfetch-'));
    await expect(fetchToFolder(`${baseUrl}/missing`, dir)).rejects.toThrow(/404/);
  });
});
