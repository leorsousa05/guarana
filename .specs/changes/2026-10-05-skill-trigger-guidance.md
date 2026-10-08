# Change 2026-10-05 — automatic skill trigger guidance

## Change

Clarified the always-on skill-capture policy with positive signals for repeatable
sequences, future-facing specialized checks, and reusable user corrections. Added
explicit non-signals for simple or one-off tasks, temporary criteria, generic
best practices, and complexity alone. Documented skill-vs-memory and scope rules
in the runtime policy and `guarana:memory` skill; added assertions for each
positive and negative trigger.

## Verification

- `node --test plugin/guarana-memory.test.mjs` — 9 passed, 0 failed.
- `npm test` — 201 passed, 0 failed across 43 suites.
- `npm run build` — PASS; Vite build and CLI bundle synchronization.
- `npm run check-cli` — PASS.
- `npm run specs:validate` — PASS, 103 Markdown files, 15 feature specs, 19
  ADRs, and 148 local links after this change record was added.
- Independent worker-verify — all four refinement criteria PASS; overall AND PASS.
