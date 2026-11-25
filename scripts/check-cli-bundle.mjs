#!/usr/bin/env node
/**
 * check-cli-bundle.js
 *
 * Exits with code 0 if `cli/` mirrors the canonical source trees, or prints
 * diffs and exits non-zero. Use in CI to prevent the bundle drifting.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pairs = [
  ['skills/guarana', 'cli/skills/guarana'],
  ['plugin/guarana-telemetry.js', 'cli/plugin/guarana-telemetry.js'],
  ['plugin/guarana-memory.js', 'cli/plugin/guarana-memory.js'],
  ['plugin/guarana-orchestrator.js', 'cli/plugin/guarana-orchestrator.js'],
  ['memory/learning-review.js', 'cli/memory/learning-review.js'],
  ['orchestrator', 'cli/orchestrator'],
  ['memory', 'cli/memory'],
  ['skill-engine', 'cli/skill-engine'],
  ['dashboard/server', 'cli/dashboard/server'],
  ['dashboard/web/dist', 'cli/dashboard/web/dist'],
];

let ok = true;
for (const relative of ['plugin/learning-review.js', 'cli/plugin/learning-review.js']) {
  if (fs.existsSync(path.join(root, relative))) {
    ok = false;
    console.error(`learning-review runtime module must not live under plugins/: ${relative}`);
  }
}
for (const relative of ['plugin/guarana-memory.js', 'cli/plugin/guarana-memory.js']) {
  if (!fs.readFileSync(path.join(root, relative), 'utf8').includes("from '../memory/learning-review.js'")) {
    ok = false;
    console.error(`memory plugin must import its sibling runtime module: ${relative}`);
  }
}
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
