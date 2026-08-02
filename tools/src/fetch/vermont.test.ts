import { describe, expect, it } from 'vitest';

import { htmlToText, isHtmlResponse, isVermontGovUrl } from './vermont.ts';

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
