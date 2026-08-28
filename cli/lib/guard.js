const fs = require('fs');
const path = require('path');

const STAMP = '.guarana-version';

// Safety guard: refuse to touch an existing dir that isn't a guarana install.
function assertGuard(target, action) {
  if (!fs.existsSync(target)) return;
  if (fs.existsSync(path.join(target, STAMP))) return;
  const skillMd = path.join(target, 'SKILL.md');
  if (fs.existsSync(skillMd)) {
    const content = fs.readFileSync(skillMd, 'utf8');
    if (/^name:\s*guarana\s*$/m.test(content)) return;
  }
  console.error(`refuse to ${action}: ${target} exists but is not a guarana install (no ${STAMP} stamp or guarana SKILL.md)`);
  process.exit(1);
}

// Plugin guard: a target file is "guarana-installed" iff byte-identical to the bundle.
function pluginIsOurs(target, bundlePath) {
  if (!fs.existsSync(target)) return false;
  const a = fs.readFileSync(target);
  const b = fs.readFileSync(bundlePath);
  return a.length === b.length && a.equals(b);
}

module.exports = { assertGuard, pluginIsOurs, STAMP };
