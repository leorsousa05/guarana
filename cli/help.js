const { VERSION } = require('./constants.js');
const { COMMANDS, GLOBAL_FLAGS } = require('./command-metadata.js');

const HELP = [
  `guarana ${VERSION} — installer for the guarana skill suite (OpenCode)`,
  '',
  'Usage:',
  ...COMMANDS.flatMap(({ globalUsage }) => globalUsage),
  ...GLOBAL_FLAGS,
  '',
  'Targets:',
  '  default      ~/.agents/skills/guarana/',
  '  --project    ./.opencode/skills/guarana/ (current working directory)',
  '',
  'Memory vault and search filter:',
  '  Memory commands always use .guarana/memory/ under the current working directory.',
  '  A global --project before memory does not switch the memory vault.',
  '  After memory search, --project <hash> filters results by project hash.',
  '  Example: guarana memory search "term" --project HASH',
  '',
  'Plugin targets:',
  '  default      ~/.config/opencode/plugins/{guarana-telemetry.js,guarana-memory.js,guarana-orchestrator.js}',
  '  --project    ./.opencode/plugins/{guarana-telemetry.js,guarana-memory.js,guarana-orchestrator.js} (current working directory)',
  '',
  'Advisor fields: primary.provider, primary.model, primary.variant,',
  '                 advisor.provider, advisor.model, advisor.variant, advisor.enabled',
  'Settings:       .guarana/advisor.json or $XDG_CONFIG_HOME/guarana/advisor.json',
  'Primary:        Agent/profile defaults only; explicit or remembered OpenCode',
  '                session model/variant selections prevail.',
  'Install/update: guarana plugin install [--project] generates configured native OpenCode profiles.',
  '',
].join('\n');

module.exports = { HELP };
