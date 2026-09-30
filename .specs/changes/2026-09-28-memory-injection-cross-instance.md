# 2026-09-28 — Cross-instance memory injection deduplication

- Added atomic, project-telemetry-backed per-session claims so separate plugin instances cannot inject the same memory IDs twice; compaction resets persisted claims.
- Merge overlapping same-session injection records produced within one transform window into a single unioned history entry.
- Added regression coverage for isolated plugin state and overlapping 5/8-node payloads.
- Verification: independent review, `npm test` 185/185, production build, CLI bundle check, specs validation, and `git diff --check` pass.
