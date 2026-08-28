const { VERSION, SKILLS } = require('./constants.js');

const HELP = `guarana ${VERSION} — installer for the guarana skill suite (OpenCode)

Usage:
  guarana install [--project]     Install the skill suite
  guarana uninstall [--project]   Remove the installed suite
  guarana list [--project]        Show installed skills, version, and plugin presence
  guarana update [--project]      Re-install from the CLI's bundled skills
  guarana plugin install [--project]    Install the telemetry plugin
  guarana plugin uninstall [--project]  Remove the telemetry plugin
  guarana web [--port N] [--no-open]  Start the guarana dashboard and open it in the browser
  guarana --help                  Show this help
  guarana --version               Show version

Targets:
  default      ~/.agents/skills/guarana/
  --project    ./skills/guarana/ (current working directory)

Plugin targets:
  default      ~/.config/opencode/plugins/guarana-telemetry.js
  --project    ./.opencode/plugins/guarana-telemetry.js (current working directory)
`;

module.exports = { HELP };
