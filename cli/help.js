const { VERSION, SKILLS } = require('./constants.js');

const HELP = `guarana ${VERSION} — installer for the guarana skill suite (OpenCode)

Usage:
  guarana install [--project]     Install the skill suite
  guarana uninstall [--project]   Remove the installed suite
  guarana list [--project]        Show installed skills, version, and plugin presence
  guarana update [--project]      Re-install from the CLI's bundled skills
  guarana plugin install [--project]    Install the telemetry, memory, and orchestrator plugins (+ engines)
  guarana plugin uninstall [--project]  Remove the telemetry, memory, and orchestrator plugins (+ engines)
  guarana plugin status [--project]     Check plugin/engine/vault install health
  guarana web [--port N] [--no-open]  Start the guarana dashboard and open it in the browser
  guarana memory <sub>            Manage the project memory vault (.guarana/memory/)
    memory init                     Create the vault (idempotent) + .gitignore entry
    memory status                   Node/edge counts, draft vs confirmed breakdown
    memory search <term> [flags]    Search confirmed nodes (--type --project --since --until --limit)
    memory export <file>            Export the vault to JSON
    memory import <file>            Import a vault JSON file
    memory prune --keep <n>         Drop oldest draft atom nodes beyond n
    memory review --list            List draft nodes awaiting confirmation
    memory review <id> --confirm    Confirm a draft node (optional --intent/--tags edits)
    memory review <id> --discard    Remove a draft node and its edges
  guarana specs validate [root] [--json]  Validate a project's .specs structure and links
  guarana --help                  Show this help
  guarana --version               Show version

Targets:
  default      ~/.agents/skills/guarana/
  --project    ./skills/guarana/ (current working directory)

Plugin targets:
  default      ~/.config/opencode/plugins/{guarana-telemetry.js,guarana-memory.js,guarana-orchestrator.js}
  --project    ./.opencode/plugins/{guarana-telemetry.js,guarana-memory.js,guarana-orchestrator.js} (current working directory)
`;

module.exports = { HELP };
