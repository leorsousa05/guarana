# 2026-09-28 — Deterministic `.specs` validator

- Added `guarana specs validate [project-root] [--json]` and `npm run specs:validate`.
- Checks required system-of-record files/sections, feature goals and acceptance criteria, ADR structure/numbering, and local Markdown references constrained to the project root.
- Returns file-specific errors, counts, machine-readable JSON, and nonzero status on invalid specs.
- `guarana:verify` now runs the validator before judging implementation criteria and keeps structural validity separate from implementation proof.
- Verification: `npm test` 179/179; current repo reports 83 Markdown files, 13 feature specs, 15 ADRs, 122 local links, 0 issues; `npm run check-cli` passes.
