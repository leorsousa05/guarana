# 2026-09-28 — Deduplicate memory injection in an active session

- Cache memory node IDs per project/session and inject only unseen nodes on later system transforms.
- Share cache across global/project orchestrator plugin copies; a marker prevents duplicate orchestration blocks when they receive the same system transform.
- Reset/reload the cache on session creation and `session.compacted`; log why each new injection occurred.
- Dashboard collapses consecutive legacy duplicates per session but keeps a fresh identical set after a compaction event.
- Verification: orchestrator/API regression tests; `npm test` 180/180; production build, `check-cli`, specs validator, global/project plugin installs pass.
