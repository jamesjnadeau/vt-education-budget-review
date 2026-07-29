#!/usr/bin/env node
/**
 * Registry sync.
 *
 *   npm run registry:sync                 fetch, snapshot, normalize, report
 *   npm run registry:sync -- --dry-run    fetch and report, write nothing
 *   npm run registry:sync -- --from DATE  rebuild from an existing snapshot, no network
 *
 * Run nightly by CI, which opens a PR when the diff is non-empty and never
 * auto-merges. Every structural change in Vermont education gets a human
 * eyeball and a commit message, and the sync log becomes a public changelog of
 * district reorganization.
 */

import { writeFileSync } from 'node:fs';

import { fetchAll } from '../registry/aoe-client.ts';
import { diffRegistry, normalizeSnapshot, type Change } from '../registry/sync.ts';
import { listSnapshots, readRegistry, readSnapshot, writeRegistry, writeSnapshot } from '../registry/store.ts';
import type { RegistryEntity } from '../registry/types.ts';

interface Args {
  readonly dryRun: boolean;
  readonly from: string | null;
  readonly summaryPath: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  const fromIndex = argv.indexOf('--from');
  const summaryIndex = argv.indexOf('--summary');
  return {
    dryRun: argv.includes('--dry-run'),
    from: fromIndex >= 0 ? (argv[fromIndex + 1] ?? null) : null,
    summaryPath: summaryIndex >= 0 ? (argv[summaryIndex + 1] ?? null) : null,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatChanges(changes: readonly Change[]): string {
  if (changes.length === 0) return 'No changes.\n';

  const byKind = new Map<string, Change[]>();
  for (const c of changes) {
    const list = byKind.get(c.kind) ?? [];
    list.push(c);
    byKind.set(c.kind, list);
  }

  const headings: Record<string, string> = {
    added: 'Added',
    closed: 'Closed',
    reopened: 'Close date removed (verify by hand)',
    removed: 'Disappeared from the API without a close date (needs a human)',
    modified: 'Modified',
  };

  let out = '';
  for (const kind of ['added', 'closed', 'reopened', 'removed', 'modified']) {
    const list = byKind.get(kind);
    if (!list || list.length === 0) continue;
    out += `\n### ${headings[kind]} (${list.length})\n\n`;
    for (const c of list) out += `- \`${c.slug}\` — ${c.detail}\n`;
  }
  return out;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const date = args.from ?? today();

  const existing = readRegistry();
  console.log(`Registry currently holds ${existing.size} entities.`);

  let snapshot;
  let snapshotPath: string | null = null;

  if (args.from) {
    console.log(`Rebuilding from snapshot ${args.from} (no network).`);
    snapshot = readSnapshot(args.from);
    snapshotPath = `registry/raw/${args.from}`;
  } else {
    console.log('Fetching from the AOE Public Data API…');
    try {
      snapshot = await fetchAll(date);
    } catch (error) {
      const snapshots = listSnapshots();
      console.error(`\nFetch failed: ${error instanceof Error ? error.message : String(error)}`);
      if (snapshots.length > 0) {
        console.error(
          `\nThe API is a convenience layer, not a dependency. Rebuild from the most\n` +
            `recent snapshot instead:\n\n  npm run registry:sync -- --from ${snapshots[snapshots.length - 1]}\n`,
        );
      }
      return 1;
    }

    for (const [endpoint, records] of Object.entries(snapshot.endpoints)) {
      console.log(`  ${endpoint}: ${records.length} records`);
    }

    if (!args.dryRun) {
      snapshotPath = writeSnapshot(snapshot);
      console.log(`Snapshot written to ${snapshotPath}`);
    }
  }

  const { entities, warnings } = normalizeSnapshot(snapshot, { existing, today: date });

  const after = new Map<string, RegistryEntity>(entities.map((e) => [e.slug, e]));
  const changes = diffRegistry(existing, after);

  console.log(`\nNormalized ${entities.length} entities.`);
  const counts = new Map<string, number>();
  for (const e of entities) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  for (const [type, count] of [...counts].sort()) console.log(`  ${type}: ${count}`);

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ! ${w}`);
  }

  const summary =
    `## Registry sync ${date}\n\n` +
    `${entities.length} entities, ${changes.length} change(s).\n` +
    formatChanges(changes) +
    (warnings.length > 0 ? `\n### Warnings\n\n${warnings.map((w) => `- ${w}`).join('\n')}\n` : '');

  console.log(`\n${formatChanges(changes)}`);

  if (args.summaryPath) {
    writeFileSync(args.summaryPath, summary, 'utf8');
  }

  if (args.dryRun) {
    console.log('Dry run: nothing written.');
    return 0;
  }

  const written = writeRegistry(entities, { today: date, snapshotPath });
  console.log(`Wrote ${written.length} registry file(s):`);
  for (const f of written) console.log(`  ${f}`);

  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
