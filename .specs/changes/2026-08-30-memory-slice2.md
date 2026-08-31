# Change: memory Slice 2 — OpenCode capture plugin

**Date:** 2026-08-30
**Feature:** [memory](../features/memory/memory.md) · Slice 2 of 4
**Stop reason:** condition-met (worker-verify PASS, first gate)

## What shipped
- `plugin/guarana-memory.js` — OpenCode plugin (ESM, zero deps, marker `// guarana memory plugin`, never throws). Hooks: `tool.execute.before/after` → draft atoms via `memory/capture.js` (output capped at 2000 chars), `file.edited`, `session.created/idle` lifecycle. Lazy: skips capture when vault uninitialized (`memory-skipped`) or `capture.enabled: false`. Telemetry via existing `.specs/state/telemetry/events.jsonl` (`memory-captured` / `memory-filtered` / `memory-error` / `memory-skipped`).
- `guarana plugin install|uninstall` now manages BOTH telemetry and memory plugins (`cli/commands/plugin.js`, per-plugin guard semantics preserved); `guarana list` reports both. Guard extended with marker param (`MEMORY_PLUGIN_MARKER`).
- Bundle mappings: memory plugin added to sync/check scripts.

## Proofs
- `npm test` 59/59 PASS (11 plugin tests + 2 new guard tests).
- `npm run check-cli` PASS.
- Worker-verify PASS (single gate): criteria 8–10 reproduced with independent driver — secrets in args and output never persisted, `memory-filtered` events emitted; never-throw verified against missing vault, malformed config, read-only vault, mid-session vault deletion, undefined hook args; capture disable/re-enable verified. CLI guard semantics verified with mktemp HOME.
- Non-blocking observations recorded: skip-telemetry dedup per session; sequential plugin install can partially apply before a foreign-file refusal (pre-existing semantics, foreign files never touched).

## Not shipped (next slices)
- Slice 3: 4 `memory_*` custom tools + draft→confirmed review workflow.
- Slice 4: automatic graph compaction (supernodes).
