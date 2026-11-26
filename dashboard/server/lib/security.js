import fs from 'node:fs';
import path from 'node:path';
import { SPECS_DIR } from './constants.js';

export function resolveSpecsDir(projectRoot) {
  const resolvedRoot = path.resolve(projectRoot);
  try {
    if (fs.realpathSync(resolvedRoot) !== resolvedRoot) return null;
    const specsDir = path.join(resolvedRoot, SPECS_DIR);
    if (!fs.lstatSync(specsDir).isDirectory()) return null;
    return specsDir;
  } catch {
    return null;
  }
}

/**
 * Resolve a user-provided relative path against an allowed root directory and
 * verify it does not escape that root (no traversal, symlinks, or absolute paths).
 *
 * Returns { resolved, realTarget, realRoot } on success, or null on failure.
 */
export function resolveAllowed(file, allowedRoots, { requireExt } = {}) {
  if (typeof file !== 'string' || file.length === 0) return null;
  if (path.isAbsolute(file)) return null;
  if (requireExt && !file.endsWith(requireExt)) return null;

  let matchedRoot = null;
  let realRoot = null;
  let realTarget = null;

  for (const root of allowedRoots) {
    const resolved = path.resolve(root, file);
    const rootResolved = path.resolve(root);
    if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) continue;
    try {
      realRoot = fs.realpathSync(rootResolved);
      if (realRoot !== rootResolved) continue;
      realTarget = fs.realpathSync(resolved);
    } catch {
      continue;
    }
    if (realTarget === realRoot || realTarget.startsWith(realRoot + path.sep)) {
      matchedRoot = root;
      break;
    }
  }

  if (!matchedRoot || !realTarget || !realRoot) return null;
  return { resolved: path.resolve(matchedRoot, file), realTarget, realRoot };
}
