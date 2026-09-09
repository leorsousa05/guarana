# Guarana

### AI Loop Engineering for OpenCode

Guarana turns an OpenCode agent into a disciplined engineering partner. Natural
task requests automatically move through planning, implementation, verification,
and memory, while the important state stays inspectable on disk.

<p>
  <a href="https://github.com/leorsousa05/guarana"><img src="https://img.shields.io/badge/version-0.7.0-7c3aed?style=flat-square" alt="Version 0.7.0"></a>
  <a href="https://opencode.ai/"><img src="https://img.shields.io/badge/runtime-OpenCode-111827?style=flat-square" alt="OpenCode runtime"></a>
  <img src="https://img.shields.io/badge/core_dependencies-zero-059669?style=flat-square" alt="Zero core runtime dependencies">
</p>

## The Short Version

You say:

```text
Add OAuth authentication to the API
```

Guarana takes it from there:

```text
restore state -> plan -> build -> code -> verify -> remember
                  ^                              |
                  +--------- fix and retry <-----+
```

No `guarana:plan` prefix is required. The orchestrator detects the task,
creates missing project specs, restores relevant confirmed memory, and injects
only the active skill into the current turn.

## Why Guarana

| Problem | Guarana's answer |
|---|---|
| Agents start coding before understanding the task | Planning is the automatic entry point |
| Long runs lose their context | State, specs, decisions, and failures live on disk |
| "Done" is confused with "it runs" | Implementation and verification are separate stages |
| Failed checks lead to repeated mistakes | Verification failures route into debugging and re-verification |
| Previous decisions disappear between sessions | Relevant confirmed memory is restored automatically |
| Prompts become bloated | Progressive disclosure injects only the active skill |

## Quick Start

Install Guarana globally:

```bash
npm install -g guarana
guarana install
```

`guarana install` installs the skill suite and the OpenCode plugins that power
automatic orchestration, memory capture, and telemetry. Open a new OpenCode
session, then describe the work normally.

For a project-local installation:

```bash
guarana install --project
```

Check the installation:

```bash
guarana list
guarana plugin status
```

## Automatic Workflow

The orchestrator persists its state in `.specs/state/workflow.json` and resumes
unfinished work across turns and sessions.

```text
idle
  |
  | natural task
  v
planning -> building -> coding -> verifying -> completed
                                      |
                                      | failed check
                                      v
                                  debugging
                                      |
                                      +----> coding -> verifying
```

Explicit commands remain available as an escape hatch:

```text
guarana:plan    guarana:build    guarana:code
guarana:verify  guarana:remember guarana:memory
guarana:debug   guarana:measure
```

## What Gets Created

On the first task in a project, Guarana creates only missing files and never
overwrites existing project content.

```text
.
├── .specs/
│   ├── README.md                    # master tracker
│   ├── state/
│   │   ├── project-state.md         # durable checkpoint
│   │   └── workflow.json             # live orchestrator state
│   ├── decisions/                   # append-only ADRs
│   └── features/<task>/              # task-specific feature spec
└── .guarana/memory/
    ├── nodes.jsonl                  # decisions, bugs, solutions, atoms
    ├── edges.jsonl                  # graph relationships
    └── config.json
```

The memory vault is project-local and gitignored. Confirmed nodes can be
automatically supplied as bounded context; captured tool atoms remain drafts
until reviewed.

## Skills

### Core

| Skill | Responsibility |
|---|---|
| `guarana:plan` | Restore state, define the goal, and select the next step |
| `guarana:build` | Run the Frame -> Run -> Verify -> Record lifecycle |
| `guarana:code` | Implement with read-before-edit and minimal diffs |
| `guarana:verify` | Independently validate the acceptance condition |
| `guarana:remember` | Maintain durable state and recover context |
| `guarana:memory` | Search, review, and manage the memory graph |

### Triggered Only When Needed

| Skill | Trigger |
|---|---|
| `guarana:debug` | A test fails or the run misbehaves |
| `guarana:measure` | Cost, telemetry, or budget health needs tuning |

## CLI Reference

```text
guarana install [--project]             Install skills, plugins, and engines
guarana update [--project]              Reinstall the bundled version
guarana list [--project]                Show skills and plugin presence
guarana uninstall [--project]           Remove the installed runtime

guarana plugin install [--project]       Install or repair OpenCode plugins
guarana plugin status [--project]        Check plugin and engine health
guarana plugin uninstall [--project]    Remove plugins and engines

guarana memory init                      Initialize a vault manually
guarana memory status                    Show node, edge, and draft counts
guarana memory search <term>             Search confirmed memory
guarana memory review --list             List draft atoms
guarana memory export <file>             Export project memory
guarana memory import <file>             Import project memory

guarana web [--port N] [--no-open]       Open the local dashboard
guarana --help                           Show all commands
```

## Project Layout

```text
skills/guarana/        OpenCode skill definitions
orchestrator/           Host-independent workflow engine
memory/                 Persistent graph and search engine
plugin/                 OpenCode host adapters
cli/                    Self-contained installer bundle
dashboard/              Local telemetry, workflow, and memory dashboard
docs/reference/         AI Loop Engineering reference material
.specs/                  Project specification and decision record
```

The core skills, plugins, orchestrator, and memory engine are dependency-free.
The CLI bundles the complete runtime and dashboard so installation does not
depend on this repository being present afterward.

## Development

```bash
git clone https://github.com/leorsousa05/guarana.git
cd guarana
npm test
npm run check-cli
```

Build the dashboard and refresh the CLI bundle:

```bash
npm run build
```

## Documentation

- [System of record](.specs/README.md)
- [Architecture](.specs/architecture.md)
- [Automatic orchestrator](docs/reference/orchestrator.md)
- [Memory model](docs/reference/memory.md)
- [Feature specifications](.specs/features/overview.md)
- [Human validation record](human-gate-validation.md)

## Status

Guarana `0.7.0` is validated with the full test suite, CLI bundle checks, and
an installed-plugin smoke test.

## License

TBD
