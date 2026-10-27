<p align="center">
  <img src="./guarana.png" alt="Guarana" width="220">
</p>

<h1 align="center">Guarana</h1>

<p align="center"><strong>AI Loop Engineering for OpenCode</strong></p>

<p align="center">
  <a href="https://github.com/leorsousa05/guarana"><img src="https://img.shields.io/github/stars/leorsousa05/guarana?style=for-the-badge&logo=github&logoColor=white&color=f59e0b" alt="GitHub stars"></a>
  <a href="https://github.com/leorsousa05/guarana/tree/main"><img src="https://img.shields.io/badge/source-v1.5.2%20candidate-f59e0b?style=for-the-badge&logo=github&logoColor=white" alt="GitHub main source candidate v1.5.2, unpublished and untagged"></a>
  <img src="https://img.shields.io/badge/core_dependencies-zero-059669?style=for-the-badge" alt="Zero core runtime dependencies">
  <br>
  <a href="https://opencode.ai/"><img src="https://img.shields.io/badge/runtime-OpenCode-111827?style=for-the-badge" alt="OpenCode runtime"></a>
  <a href="https://github.com/leorsousa05/guarana/commits/main"><img src="https://img.shields.io/github/last-commit/leorsousa05/guarana?style=for-the-badge&color=7c3aed" alt="Last commit"></a>
  <a href="https://github.com/leorsousa05/guarana/blob/main/package.json"><img src="https://img.shields.io/badge/node-22%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js 22 or newer"></a>
</p>

<p align="center">
  <em>State on disk. Decisions with memory. Verification before done.</em>
</p>

Guarana turns an OpenCode agent into a disciplined engineering partner. Natural
task requests automatically move through planning, implementation, verification,
and memory, while the important state stays inspectable on disk.

<p>
  <img src="https://img.shields.io/badge/released-2026--10--25-7c3aed?style=flat-square" alt="Released October 25, 2026">
  <img src="https://img.shields.io/badge/license-MIT-2563eb?style=flat-square" alt="MIT license">
</p>

**Current source candidate:** `1.5.2` is unpublished and untagged; its source is on [`main`](https://github.com/leorsousa05/guarana/tree/main). The stable installation instructions below remain for the `v1.5.0` tag.

## What's New in 1.5.0

> **Stable source/tag release · 2026-10-25** — see the [full changelog](CHANGELOG.md).

| Area | Highlights |
|---|---|
| **Activity & Overview** | Live operational workbenches for execution, workflow context, active workers, Advisor runtime, and confirmed-memory context. |
| **Model configuration** | Connected OpenCode providers and models, model-specific variant suggestions, and manual-entry fallbacks for Primary and Advisor. |
| **Memory Graph** | Accessible Map/Index views, a pan-and-zoom map, selected-memory inspector, and stable selection positioning. |
| **Workflow reliability** | Atomic task kickoff, bounded evidence-based blocker recovery, meaningful phase progress reports, and resilient late telemetry metadata. |

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
creates missing project specs, searches project knowledge on demand, and injects
the active skill plus eligible global user preferences as one complete,
budget-bounded payload. Direct, one-hop related, and reached superseded
preferences retain separate trust groups.

## Why Guarana

| Problem | Guarana's answer |
|---|---|
| Agents start coding before understanding the task | Planning is the automatic entry point |
| Long runs lose their context | State, specs, decisions, and failures live on disk |
| "Done" is confused with "it runs" | Implementation and verification are separate stages |
| Failed checks lead to repeated mistakes | Verification failures route into debugging and re-verification |
| User preferences disappear between sessions | Bounded confirmed global preferences are injected; project knowledge stays on-demand |
| Prompts become bloated | Progressive disclosure injects only the active skill |

## Quick Start

### Requirements and support

- **Node.js 22 or newer.** CI validates Node 22.x and 24.x.
- **OpenCode:** Guarana targets OpenCode's plugin API. Package and host smoke
  tests are retired and are not release validation; see the [no-smoke policy and
  ordinary release checks](RELEASING.md).

### Install from GitHub (v1.5.0)

Guarana 1.5.0 is not published on npm. Clone the GitHub tag and link the local
CLI:

```bash
git clone --depth 1 --branch v1.5.0 https://github.com/leorsousa05/guarana.git
cd guarana
npm link
```

`npm link` registers the CLI from this local checkout globally; it does not
download a `guarana` package from npm or publish anything. Keep the cloned
checkout available while using the linked CLI.

Then install Guarana's skills and plugins:

```bash
guarana install
```

`guarana install` installs the skill suite and the OpenCode plugins that power
automatic orchestration, explicit memory decisions, and telemetry. Open a new OpenCode
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

### Primary model defaults

Configure Primary in Guarana Web's Models page or with `guarana advisor set
primary.provider <provider-id>` and `guarana advisor set primary.model <model-id>`
(optionally `primary.variant`). Project settings override global settings for the
generated Guarana agent/profile defaults only. Explicit or remembered OpenCode
session model/variant selections prevail; Guarana does not force request options
or rewrite session selections. Advisor consultations remain optional.

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
    ├── nodes.jsonl                  # decisions, bugs, solutions, refactors
    ├── edges.jsonl                  # graph relationships
    └── config.json
```

Project knowledge lives in a gitignored vault and is searched on demand; it is
never injected into assistant context. Standing user preferences live in the
private global vault. Every eligible confirmed active global preference is
included with its full text, together with eligible one-hop related context,
subject to a single effective budget. Direct, related, and reached superseded
preferences remain separate groups; related context is exactly one relationship
hop from the direct group. New preferences use `agent_behavior`, `workflow`, or
`communication`; legacy category-less global preferences read as `general`.
If the complete serialized payload cannot fit the configured/model budget—or no
usable budget exists—the whole preference payload is omitted with an explicit
notice. UTF-8 serialized bytes compared with the token budget are an estimate,
not exact tokenization or remaining conversation capacity.
Guarana Web's memory graph displays both scopes and their relationships. Normal
tool activity remains telemetry and never becomes a memory atom.

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
guarana install [--project]
guarana update [--project]
guarana list [--project]
guarana uninstall [--project]

guarana plugin install [--project]
guarana plugin install --plugins-only [--project]
guarana plugin uninstall [--project]
guarana plugin uninstall --plugins-only [--project]
guarana plugin adopt <plugin-file> --accept-current [--project]
guarana plugin status [--project]

guarana web [--port N] [--open|--no-open]

guarana advisor models [provider]
guarana advisor read [--project]
guarana advisor set <field> <id> [--project]
guarana advisor clear [field] [--project]
guarana advisor status [--project]

guarana memory <sub>
guarana memory init
guarana memory status
guarana memory search [term] [flags]
guarana memory export <file>
guarana memory import <file>
guarana memory compact [--threshold <n>]
guarana memory prune --keep <n>
guarana memory review --list
guarana memory review <id> --confirm --type <decision|bug|solution|refactor>
guarana memory review <id> --discard
guarana memory delete <id> --scope <project|global> --confirm
guarana memory --help
guarana memory -h

guarana specs validate [project-root] [--json]
guarana specs record --stdin
guarana specs record --file .specs/state/worker-specs-handoff.json
guarana specs --help
guarana specs -h

guarana workflow read [--project]
guarana workflow set <specs|verify> <true|false> [--project]
guarana workflow set memory.preferenceInjectionBudgetTokens <positive-integer> [--project]
guarana workflow clear [specs|verify|memory.preferenceInjectionBudgetTokens] [--project]
guarana workflow --help
guarana workflow -h

guarana --help
guarana --version
```

`guarana web` starts the local dashboard. Saved launch preferences can be
overridden for one run with `--port N`, `--open`, or `--no-open`. Advisor
commands list available OpenCode models, inspect or update scoped model settings,
and check managed command/profile health. Workflow settings support `specs` and
independent `verify` preferences. The `memory.preferenceInjectionBudgetTokens`
budget can be read, set to a positive integer, or cleared; project values override
global settings, and clearing a project value restores global inheritance. `--project`
selects the project settings.

The Dashboard's **Workflow** screen also shows the current parallel-subtask run,
when one is bound: its status and update time, plus each task's ID, mode, status,
and dependencies. This view is read-only, follows the selected project, and may
continue to show a completed run until a new task or abort starts a new boundary.
It does not browse run history or expose worktree paths and other private worker
metadata; task creation and orchestration remain with the primary workflow.

Memory search also accepts `--type <type>`, `--since <date|ms>`,
`--until <date|ms>`, and `--limit <n>`. `compact` accepts an optional
`--threshold <n>`. Legacy project preference, atom, and supernode records remain
available only through explicit legacy read/search paths; compact and prune
preserve them and neither create nor delete them. Confirming a legacy draft
requires explicit conversion to `decision`, `bug`, `solution`, or `refactor`;
the converted record can be edited with `--intent "..."` and/or `--tags a,b`.
`specs record --stdin` reads a handoff from standard input;
`--file` reads and removes the fixed handoff file. `--help` and `--version`
also accept `-h` and `-v`, respectively.

For install, update, list, uninstall, and plugin operations, `--project` selects
project-local targets under the current working directory's `.opencode/`
instead of the user-level targets. Plugin `--plugins-only` install refreshes
plugins and engines while preserving native profiles; `--plugins-only`
uninstall removes only plugin files and their manifest group.

Memory commands always use `.guarana/memory/` under the current working
directory. A global `--project` before `memory` does not switch the memory
vault. For a memory search, put `--project HASH` after `search` to filter results
by project hash (for example, `guarana memory search "term" --project HASH`).

`guarana plugin adopt` is a deliberate ownership transition, not a force option.
It accepts exactly one allowlisted Guarana plugin filename and requires the
`--accept-current` acknowledgment, an existing valid manifest entry, a regular
plugin file with that plugin's Guarana marker, and bytes that differ from the
tracked hash. It updates only that manifest entry's SHA-256; plugin bytes and
other manifest entries are preserved. Review the current plugin bytes before
using it. Normal install and uninstall continue to reject tracked modifications
unless this command explicitly records their current hash.

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
- [Release process and 1.0 gate](RELEASING.md)
- [Changelog](CHANGELOG.md)

## Status

Guarana `1.5.0` is designated Stable for delivery through the repository source
and matching GitHub tag `v1.5.0`. npm publication and a formal LTS duration or
maintenance period are not part of this release.

## License

MIT
