#!/usr/bin/env node
/**
 * sync-cli-bundle.js
 *
 * Keeps the `cli/` self-contained bundle in sync with the canonical source:
 *   skills/        -> cli/skills/
 *   plugin/        -> cli/plugin/
 *   dashboard/     -> cli/dashboard/
 *
 * This script is the single source-of-truth mechanism for the installer bundle.
 * Run it after any change to skills, plugin, dashboard server, or dashboard web dist.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const mappings = [
  { from: 'skills/guarana', to: 'cli/skills/guarana' },
  { from: 'plugin/guarana-telemetry.js', to: 'cli/plugin/guarana-telemetry.js' },
  { from: 'dashboard/server', to: 'cli/dashboard/server' },
  { from: 'dashboard/web/dist', to: 'cli/dashboard/web/dist' },
];

for (const { from, to } of mappings) {
  const src = path.join(root, from);
  const dest = path.join(root, to);
  const stat = fs.statSync(src);
  if (stat.isDirectory()) copyDir(src, dest);
  else copyFile(src, dest);
  console.log(`synced ${from} -> ${to}`);
}

console.log('CLI bundle is in sync.');
