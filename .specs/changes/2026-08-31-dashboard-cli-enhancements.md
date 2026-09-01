# 2026-08-31 — dashboard & CLI enhancements

Feature batch on the dashboard (resume card, health gauges, decision lineage) and the CLI (`plugin status`). All verified: `npm test` 120/120, `check-cli` PASS, frontend builds, engine/plugins redeployed.

## CLI
1. **`guarana plugin status [--project]`** — one-command install health check:
   - per-plugin: installed? / up to date vs bundle? / foreign (not installed by guarana)?
   - memory engine deployed at `memoryEngineTarget`? (tools.js + vault.js + graph.js)
   - vault initialized in cwd? (`.guarana/memory/nodes.jsonl`)
   - engine health: dynamically loads the deployed engine's `tools.js` and confirms the 4 custom-tool handlers are present.
   - Documented in `cli/help.js`. Detects the "memory engine not available" / stale-plugin failure class without a live session.

## Dashboard
2. **Resume card** (`NowPanel.jsx`) — shows the open goal from the project-state checkpoint plus a "copy resume prompt" button (clipboard) that emits a ready-to-paste opencode prompt: restore `.specs` in order, then `memory_get_context_for_task` to recover rationale/rejected alternatives/bugs. Closes the exact loop the memory final gate proved.
3. **Health gauges** (`NowPanel.jsx` + CSS) — data-backed bars from telemetry: error rate (errors/toolCalls), token volume vs an ADR-005 aggregate reference (18k), and run count. NOTE: stop-reason distribution is not surfaced — that data only exists in prose (measure skill docs), not a structured file the dashboard reads; surfaced honest telemetry instead of fabricating.
4. **Decision lineage / supersedes diff** (`MemoryGraph.jsx` + `lib/lineage.js`) — when a graph node is selected, show its `supersedes` chain as an ordered "diff": nodes it replaced (oldest→newest) and nodes that replaced it. `buildLineage` is a pure function extracted to `dashboard/web/src/lib/lineage.js` and unit-tested (cycle-safe, ignores non-supersedes edges).

## Files
- `cli/commands/plugin.js` (status + filesEqual + engineHealthy), `cli/help.js`
- `dashboard/web/src/components/NowPanel.jsx`, `MemoryGraph.jsx`, `lib/lineage.js` (new)
- `dashboard/server/lib/lineage.test.js` (new, 5 tests)
- `dashboard/web/src/style.css` (resume/health/lineage styles)
- bundle re-synced; engine + plugins redeployed

## Verification
- `npm test` 120/120; `npm run check-cli` PASS; frontend build clean.
- `plugin status` confirmed: stale plugin detected when a copy differs, returns to ok after reinstall; project vs global targets both work.