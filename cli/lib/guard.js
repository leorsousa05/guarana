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

// Marker present in every guarana-authored version of the telemetry plugin.
const PLUGIN_MARKER = '// guarana telemetry plugin';

// Plugin guard: a target file is "guarana-installed" iff it is byte-identical
// to the current bundle OR carries the guarana marker header (i.e. an older
// guarana version). Files without the marker are foreign and never touched.
function pluginIsOurs(target, bundlePath) {
  if (!fs.existsSync(target)) return false;
  const a = fs.readFileSync(target);
  const b = fs.readFileSync(bundlePath);
  if (a.length === b.length && a.equals(b)) return true;
  return a.toString('utf8', 0, 512).includes(PLUGIN_MARKER);
}

module.exports = { assertGuard, pluginIsOurs, STAMP };
