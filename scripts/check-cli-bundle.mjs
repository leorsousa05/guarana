#!/usr/bin/env node
/**
 * check-cli-bundle.js
 *
 * Exits with code 0 if `cli/` mirrors the canonical source trees, or prints
 * diffs and exits non-zero. Use in CI to prevent the bundle drifting.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pairs = [
  ['skills/guarana', 'cli/skills/guarana'],
  ['plugin/guarana-telemetry.js', 'cli/plugin/guarana-telemetry.js'],
  ['plugin/guarana-memory.js', 'cli/plugin/guarana-memory.js'],
  ['plugin/guarana-orchestrator.js', 'cli/plugin/guarana-orchestrator.js'],
  ['orchestrator', 'cli/orchestrator'],
  ['dashboard/server', 'cli/dashboard/server'],
  ['dashboard/web/dist', 'cli/dashboard/web/dist'],
  ['memory', 'cli/memory'],
];

let ok = true;
for (const [from, to] of pairs) {
  const res = spawnSync(
    'diff',
    ['-ruq', '--exclude=node_modules', path.join(root, from), path.join(root, to)],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  if (res.status !== 0) {
    ok = false;
    console.error(`DRIFT detected: ${from} -> ${to}`);
    console.error(res.stdout || res.stderr);
  }
}

if (ok) {
  console.log('CLI bundle matches canonical sources.');
  process.exit(0);
} else {
  console.error('Run `node scripts/sync-cli-bundle.mjs` to fix.');
  process.exit(1);
}
