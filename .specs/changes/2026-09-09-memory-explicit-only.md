# Change: retire automatic memory capture

**Date:** 2026-09-09
**Feature:** [memory](../features/memory/memory.md)

## What changed

- Removed `tool.execute.before`, `tool.execute.after`, and `file.edited` memory
  hooks from the OpenCode memory plugin.
- Kept session lifecycle telemetry, confirmed-context retrieval, compaction, and
  explicit memory tools.
- `memory_save_decision` is now the only normal path for creating durable memory
  and writes a confirmed node directly.
- The existing verified-workflow completion record remains; it is a single
  deliberate system decision, not automatic command capture.
- Removed the dashboard drafts panel and labels; legacy draft review remains in
  the CLI/API for migration or cleanup.
- Updated the source docs and synchronized the plugin and memory engine into
  `cli/`.
