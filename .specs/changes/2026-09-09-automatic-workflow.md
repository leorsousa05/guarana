# Change: automatic workflow, specs, and memory bootstrap

**Date:** 2026-09-09  
**Status:** VALIDATED  
**Version:** 0.7.0

## What changed
- `guarana install` and `update` now install the telemetry, memory, and orchestrator plugins plus both engines; uninstall removes the paired runtime.
- Natural task input stores the task as `goal`/`activeTask`, creates missing `.specs` scaffolding and a task feature spec, and initializes `.guarana/memory/`.
- The orchestrator injects bounded relevant confirmed memory, refreshes the active skill after workflow ticks, and records verified completion decisions.
- Memory capture/tools initialize a missing vault automatically; drafts remain excluded from injected context.
- Intent detection recognizes broader task verbs and problem reports; globally installed skills are resolvable by the orchestrator.
- Verification failure detection ignores failure words inside successful command prose while preserving real error-shaped signals.

## Proof
- `npm test` — 166/166 passed.
- `npm run check-cli` — CLI bundle matches canonical sources.
- Temporary-HOME install/uninstall smoke — plugins and engines deployed and removed.
- Installed plugin smoke — natural task entered `planning`, created `.specs` and memory, and injected `# guarana:plan`.
- Independent worker-verify — overall PASS, six criteria.
