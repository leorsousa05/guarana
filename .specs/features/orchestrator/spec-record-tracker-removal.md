# Feature spec: Safe specs tracker-row removal

**Status: VALIDATED**

## Goal
Extend the validated specs recorder with an optional, auditable, atomic operation for removing specifically named Master tracker rows.

## Requirements
- Add a backwards-compatible optional task.removeTrackerNames string array to schema-v1 handoffs; omission leaves existing handoffs unchanged.
- Remove only matching data rows from the .specs/README.md Master tracker by exact tracker-name cell; preserve the header, separator, all other rows, and other content. Names with no matching row are a no-op.
- Reject empty, duplicate, malformed, or upsert-trackerName-equal removal names.
- Keep removals, the normal upsert, checkpoint, and receipt in one all-or-nothing transaction; run validation before commit and include the actual removed names in JSON output.
- Update canonical and CLI-mirrored recorder code and add focused rollback, security, and idempotency tests.
- Use the new capability to remove exactly the stale Configurable workflow automation preferences row while preserving the Workflow preferences and Unified dashboard Settings page rows, both with VALIDATED status.

## Assumptions and scope
- The schema-v1 specs recorder, its canonical and CLI-mirrored implementation, and focused tests.
- The subsequent exact-name removal of the one stale tracker row described in the accepted requirements; do not edit the tracker directly.
- Keep Settings and workflow-preferences feature status VALIDATED; keep package version 1.3.1; any commit/push is limited to origin/main; do not tag, publish to npm, or make a public release.
- Use ADR-005 default budgets: worker-code 8k and worker-verify 4k tokens per dispatch; per-run hard cap 32k tokens / 15 minutes.

## Acceptance criteria
1. Omitting task.removeTrackerNames preserves current schema-v1 behavior; a supplied string array is validated without coercion.
2. Each removal targets only a data row whose tracker-name cell exactly matches a supplied name; absent names remove nothing, and the JSON result lists only names actually removed.
3. Empty, duplicate, malformed, and upsert-trackerName-equal removal names are rejected before any target record changes; tests prove exact targeting, preservation, and repeated-call idempotency.
4. Removal, the ordinary tracker upsert, checkpoint, and receipt commit atomically only after validation; injected update or validation failures restore all prior contents, with focused rollback coverage.
5. Canonical and CLI-mirrored recorder implementations are synchronized, and focused security and idempotency tests pass.
6. Applying the capability removes exactly Configurable workflow automation preferences and preserves the Workflow preferences and Unified dashboard Settings page rows with VALIDATED status.
7. Independent worker-verify passes the accepted criteria and guarana specs validate . --json passes; no version bump, tag, npm publication, or public release occurs.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS.; guarana specs validate . --json: exit 0; 191 Markdown files, 70 feature specs, 34 ADRs, 210 links, 0 issues.; node --test cli/commands/specs.test.js: 22/22 passed.; npm test: 558/558 passed; nonfatal WebSocket/module warnings only.; npm run check-cli: PASS.; npm run smoke:pack: PASS for guarana-1.3.1.tgz; 131 files, no node_modules.; git diff --check: PASS.; Criterion proof in cli/lib/spec-record.js and cli/commands/specs.test.js: optional field omission preserves prior output; exact-name data-row deletion preserves header, separator, nonmatching rows, and other README sections; absent name is a no-op and repeated call is idempotent; empty, duplicate, malformed, wrong-type, and same-as-upsert names are rejected before writes; post-removal validator failure rolls back README/state/feature; successful result reports actual removed names.; Before removal, primary read .specs/README.md line 12 and observed the exact stale row with tracker name Configurable workflow automation preferences and status TASKED. The worker-specs recorder returned removedTrackerNames: ["Configurable workflow automation preferences"]. The independent verifier then confirmed zero rows with that stale name and exactly one each of Unified dashboard Settings page with status VALIDATED and Workflow preferences with status VALIDATED. This establishes that the stale row existed in the pre-operation worktree and was actually removed by the recorder.; Commit/push to origin/main is authorized and pending; version is 1.3.1. No tag, npm publish, or public release occurred.
Change: none
<!-- guarana:record:end -->
