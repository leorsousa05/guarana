# 2026-09-28 — Include global user memory in the web graph

- The memory API now merges confirmed nodes/edges from the project vault and private user vault; summary totals include a by-scope breakdown.
- The graph labels each node/edge by scope and uses scope-qualified internal IDs so identical node IDs cannot collide across vaults.
- Added API coverage for project/global nodes and scoped relationships; Memory overview shows project/global counts.
- Verification: `npm test` 181/181, production build, CLI bundle/spec checks pass.
