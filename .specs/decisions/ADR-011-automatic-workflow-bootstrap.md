# ADR-011 - Automatic workflow, specs, and memory bootstrap

**Status:** Accepted (2026-09-09) · append-only

## Context
The orchestrator was present in the repository but normal skill installation
did not install it, and the runtime still required manual memory initialization,
manual retrieval, and manual cold-start spec scaffolding. That made the claimed
automatic loop depend on the user naming Guarana steps first.

## Decision
1. `guarana install` installs the telemetry, memory, and orchestrator plugins
   and their engines. `guarana plugin install` remains an idempotent repair path.
2. On a natural new task, the orchestrator creates only missing `.specs/`
   scaffolding and a task-specific feature spec. Existing files are never
   overwritten.
3. The project memory vault is initialized automatically. Relevant confirmed
   memory is retrieved on task start/resume and injected with a bounded context;
   drafts remain excluded. A verified completed workflow records a confirmed
   completion decision automatically.
4. The persisted workflow stores the task as both `goal` and `activeTask`.

## Tradeoffs
- Automatic context uses some prompt space, bounded to ten memory nodes.
- Automatic completion decisions add machine-generated nodes, but make future
  resume context useful without requiring a special command.
- Existing foreign `.specs` files and plugin files are preserved rather than
  overwritten; Guarana degrades instead of taking ownership silently.

## Supersedes
The automatic-retrieval and lazy-vault portions of ADR-008/ADR-010-era memory
behavior and the manual cold-start-only behavior in ADR-006. The append-only
decision history itself remains unchanged.
