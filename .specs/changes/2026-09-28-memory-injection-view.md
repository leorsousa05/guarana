# 2026-09-28 — Brain view for injected memory

- The orchestrator emits reference-only `memory-injected` events when context is appended to the system prompt.
- `GET /api/memory/injections` hydrates referenced nodes from the project and private global vaults; telemetry never duplicates memory text.
- Added an Injected tab as the default Memory view: bilateral project/global brain, type-colored neurons, selectable memory detail, and recent injection history.
- Deduplicated injection per session/node set; repeated system transforms and duplicate plugin copies no longer add repeated context or history. Session compaction clears the cache for one fresh injection.
- Dashboard history collapses legacy consecutive duplicate injection events and preserves the next identical set after compaction.
- Verification: `npm test` 180/180, `npm run build`, `npm run check-cli`.
