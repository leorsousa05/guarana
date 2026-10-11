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
const EXCLUDED_DIRECTORIES = new Set(['node_modules']);

function lstatIfExists(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

function isPreservedNodeModules(target) {
  if (path.basename(target) !== 'node_modules') return false;
  const stat = lstatIfExists(target);
  if (stat?.isDirectory()) return true;
  if (!stat?.isSymbolicLink()) return false;
  try {
    return fs.statSync(target).isDirectory();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function removePathPreservingNodeModules(target) {
  if (isPreservedNodeModules(target)) return;
  const stat = lstatIfExists(target);
  if (!stat) return;
  if (!stat.isDirectory()) {
    fs.rmSync(target, { force: true });
    return;
  }

  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const child = path.join(target, entry.name);
    if (isPreservedNodeModules(child)) continue;
    removePathPreservingNodeModules(child);
  }

  try {
    fs.rmdirSync(target);
  } catch (error) {
    if (error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST') throw error;
  }
}

function syncDir(src, dest) {
  if (isPreservedNodeModules(dest)) return;
  const destStat = lstatIfExists(dest);
  if (destStat && !destStat.isDirectory()) removePathPreservingNodeModules(dest);
  fs.mkdirSync(dest, { recursive: true });
  const sourceEntries = fs.readdirSync(src, { withFileTypes: true })
    .filter((entry) => !(entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)));
  const sourceNames = new Set(sourceEntries.map((entry) => entry.name));

  for (const entry of fs.readdirSync(dest, { withFileTypes: true })) {
    const destPath = path.join(dest, entry.name);
    if (isPreservedNodeModules(destPath) || sourceNames.has(entry.name)) continue;
    removePathPreservingNodeModules(destPath);
  }

  for (const entry of sourceEntries) {
    const sourcePath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const destStat = lstatIfExists(destPath);
    if (isPreservedNodeModules(destPath)) continue;

    if (entry.isDirectory()) {
      if (destStat && !destStat.isDirectory()) removePathPreservingNodeModules(destPath);
      syncDir(sourcePath, destPath);
    } else {
      if (destStat?.isDirectory()) removePathPreservingNodeModules(destPath);
      if (lstatIfExists(destPath)?.isDirectory()) {
        throw new Error(`Cannot replace ${destPath}: it contains a preserved node_modules directory.`);
      }
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const mappings = [
  { from: 'skills/guarana', to: 'cli/skills/guarana' },
  { from: 'plugin/guarana-telemetry.js', to: 'cli/plugin/guarana-telemetry.js' },
  { from: 'plugin/guarana-memory.js', to: 'cli/plugin/guarana-memory.js' },
  { from: 'plugin/guarana-orchestrator.js', to: 'cli/plugin/guarana-orchestrator.js' },
  { from: 'orchestrator', to: 'cli/orchestrator' },
  { from: 'dashboard/server', to: 'cli/dashboard/server' },
  { from: 'dashboard/web/dist', to: 'cli/dashboard/web/dist' },
  { from: 'memory', to: 'cli/memory' },
  { from: 'skill-engine', to: 'cli/skill-engine' },
];

export function syncCliBundle(syncRoot = root, syncMappings = mappings) {
  for (const { from, to } of syncMappings) {
    const src = path.join(syncRoot, from);
    const dest = path.join(syncRoot, to);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) syncDir(src, dest);
    else copyFile(src, dest);
    console.log(`synced ${from} -> ${to}`);
  }

  console.log('CLI bundle is in sync.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncCliBundle();
}
