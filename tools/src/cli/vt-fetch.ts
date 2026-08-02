#!/usr/bin/env node
/**
 * Fetch pages and documents from vermont.gov into a folder.
 *
 *   npm run vt:fetch -- <url> [<url> ...] [--out <dir>]
 *
 * Default output folder is /tmp. HTML pages are saved as extracted text;
 * PDFs and other documents are saved as raw bytes. Only vermont.gov hosts are
 * allowed -- any other URL is refused before a request is made. See AGENT.md.
 */

import { fetchToFolder, isVermontGovUrl } from '../fetch/vermont.ts';

interface Args {
  readonly urls: string[];
  readonly outDir: string;
}

function parseArgs(argv: string[]): Args {
  const urls: string[] = [];
  let outDir = '/tmp';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out' || arg === '-o') {
      const next = argv[i + 1];
      if (!next) throw new Error('--out needs a directory');
      outDir = next;
      i += 1;
    } else if (arg !== undefined) {
      urls.push(arg);
    }
  }
  return { urls, outDir };
}

const USAGE = 'usage: npm run vt:fetch -- <url> [<url> ...] [--out <dir>]';

async function main(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${(error as Error).message}\n${USAGE}`);
    return 1;
  }

  if (args.urls.length === 0) {
    console.error(USAGE);
    return 1;
  }

  let failed = false;
  for (const url of args.urls) {
    if (!isVermontGovUrl(url)) {
      console.error(`refused: ${url} is not a vermont.gov URL`);
      failed = true;
      continue;
    }
    try {
      const r = await fetchToFolder(url, args.outDir);
      console.log(r.savedPath);
      console.log(`  ${r.status} ${r.kind} ${r.bytes}B sha256:${r.sha256}`);
    } catch (error) {
      console.error(`error: ${url}: ${(error as Error).message}`);
      failed = true;
    }
  }
  return failed ? 1 : 0;
}

process.exit(await main());
