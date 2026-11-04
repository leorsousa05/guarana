# Change — Dashboard Global preference candidate-size estimate

**Status: VALIDATED — not SHIPPED.**

## Outcome

Dashboard Settings displays an approximate candidate count and serialized-byte estimate beside the budget selector. `GET /api/memory/preference-estimate` returns only `{candidateCount, serializedBytes}`, using the established compact serializer and UTF-8 serialized-byte estimate.

The candidate set includes eligible confirmed direct Global preferences and existing one-hop related/superseded groups before budget fitting and session deduplication. It excludes unrelated stored Global records and is not restricted to active records. The UI provides loading and unavailable states and refreshes through 15-second polling. No schema, storage, or CLI settings contract changed. Tests use synthetic temporary-vault fixtures only; no real Global vault was inspected, and no browser smoke was performed.

## Independent verification and checks

- Fresh independent `worker-verify` overall PASS, criteria 1–17. Criterion 15 now proves estimate A is replaced by B and both share the same `.settings-row`; the earlier coverage gap was fixed by an SSR regression test, not a runtime defect.
- `npm test` — PASS, 717 passed and 0 failed.
- `npm run build` — PASS, 60 modules and canonical-to-CLI sync; `npm run check-cli` — PASS.
- Pre-record `npm run specs:validate` — PASS: 257 Markdown, 100 features, 47 ADRs, 296 links, 0 issues.
- `git diff --check` — PASS.

## Boundary

This estimate follow-up is VALIDATED, not SHIPPED.
