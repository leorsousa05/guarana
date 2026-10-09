import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARED_MODULES = new Set(['advisor-settings.js', 'advisor-profiles.js', 'opencode-model-catalog.js']);

export function resolveSharedAdvisorModule(name, routeUrl = import.meta.url) {
  if (!SHARED_MODULES.has(name)) throw new Error(`Unsupported shared advisor module: ${name}`);

  const routeDir = path.dirname(fileURLToPath(routeUrl));
  for (const relativeDir of ['../../../cli/lib', '../../../lib']) {
    const candidate = path.resolve(routeDir, relativeDir, name);
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Unable to resolve shared advisor module: ${name}`);
}
