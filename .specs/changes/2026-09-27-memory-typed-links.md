# 2026-09-27 — Typed memory nodes and explicit links

- Added `memory_save_node` for confirmed decisions, bugs, solutions, and refactors with optional explicit links to existing confirmed nodes.
- Added `fixes` and `relates-to` graph relationships; task context follows them and returns related node types in separate groups.
- Preserved `memory_save_decision` as a compatible wrapper and tool.
- Reclassified the memory-engine deployability records as a solution and a bug, respectively, and linked the solution with `fixes`.
- Verification: `npm test` (168/168), `npm run build`, `npm run check-cli`.
