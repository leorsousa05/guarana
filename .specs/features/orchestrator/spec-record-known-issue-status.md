# Feature spec: Known-issue status updates via specs record

**Status: VALIDATED**

## Goal
Add a deterministic, versioned operation to the fixed guarana specs record handoff for updating existing known-issue statuses without manual edits.

## Requirements
- Preserve schema-v1 behavior for ordinary task handoffs, and keep the new CLI accepting v1.
- Use schema v2 for known-issue status updates so Guarana 1.3.1, which accepts only v1, rejects v2 before changing records rather than ignoring an unknown v1 field.
- A v2 envelope has top-level `schema: "v2"` and requires a non-empty top-level `knownIssueStatusUpdates` array of `{ "heading": "<exact text after ##>", "status": "<non-empty single-line free text>" }` entries. An optional top-level `task` uses the existing schema-v1 task shape.
- Status-only v2 omits `task`; combined v2 includes it and commits task plus issue writes atomically. Schema v1 remains the ordinary task-only path.
- Each update's `heading` names the exact full H2 heading text and its `status` supplies non-empty single-line free-form status text; do not normalize statuses to an enum.
- Within the exact unique H2 section, replace only the last exact - **Status:** bullet line. Preserve earlier Status lines, Status at ... (superseded) labels, all other bytes, and all other sections.
- Reject missing or duplicate headings, missing exact status bullets, duplicate target headings, malformed or empty or multiline values, and invalid v2 envelopes before any record write; do not coerce inputs or echo payload values in errors.
- When changed, report .specs/state/known-issues.md and add `updatedKnownIssueHeadings` containing the exact target headings without full status prose; repeated identical updates are idempotent.
- Combined task and issue writes roll back together on filesystem or specs-validation failure. Status-only updates touch no file other than known-issues.md and do not alter README, project-state, or feature specs.
- Update canonical and CLI-mirrored recorder, parser, help, tests, and worker-specs instructions/examples. Keep the fixed command/profile shell allowlist unchanged, add no dependencies, preserve Node >=22, and preserve v1 output/status behavior.

## Assumptions and scope
- Existing known-issue status values are free-form text.
- Guarana 1.3.1 accepts schema v1 only and ignores unknown v1 fields.
- Schema-v2 contract for the existing fixed-file worker-specs recorder invocation.
- Canonical and CLI-mirrored recorder/parser/help/tests plus worker-specs instructions/examples.
- No application implementation, tests, package/version changes, or edits to the current known-issues file during this planning dispatch.
- Use ADR-005 budgets: worker-code 8k and worker-verify 4k tokens per dispatch; per-run hard cap 32k tokens and 15 minutes; main thread at most 8k steady-state.

## Acceptance criteria
1. The existing fixed guarana specs record --file .specs/state/worker-specs-handoff.json invocation accepts schema-v1 ordinary task handoffs with unchanged behavior, and the new CLI continues accepting v1.
2. Schema v2 has top-level `schema: "v2"` and requires non-empty `knownIssueStatusUpdates` entries with exact `heading` and non-empty single-line free-form `status`; optional top-level `task` uses the existing schema-v1 task shape. Guarana 1.3.1 rejects v2 before changing any record.
3. Status-only v2 omits `task`; combined v2 includes it and atomically commits task plus issue writes. Schema v1 remains the ordinary task-only path. Only the last exact - **Status:** bullet in the exact unique H2 section changes; earlier status history, superseded labels, unrelated bytes, and other sections remain unchanged.
4. Missing or duplicate headings, missing exact status bullets, duplicate target headings, wrong-type, malformed, empty, or multiline values, and invalid v2 envelopes are rejected before writes without coercion or echoing payload values.
5. Status-only writes change only .specs/state/known-issues.md and leave README, project-state, and feature specs byte-identical. Combined task and issue writes are one transaction and restore all touched records after a filesystem or specs-validation failure.
6. Changed results identify .specs/state/known-issues.md and add `updatedKnownIssueHeadings` listing exact target headings without full status prose; repeating identical updates makes no additional changes.
7. Focused tests distinguish valid status-only and combined v2 writes, v1 compatibility, v2 fail-closed behavior, exact targeting, history and unrelated-byte preservation, invalid no-write cases, rollback, and idempotency.
8. Canonical and CLI mirrors for recorder, parser, help, tests, and worker-specs guidance/examples are synchronized; the fixed shell allowlist is unchanged, no dependency is added, Node >=22 remains supported, and v1 output/status behavior is unchanged.
9. After implementation and record updates, focused tests, npm test, npm run check-cli, and guarana specs validate . --json pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall PASS for all 9/9 acceptance criteria.; Independent validation gate before and after review: guarana specs validate . --json returned ok:true, 193 files, 0 issues.; Independent focused specs tests PASS, 27/27; the exact command was not supplied.; Independent npm test PASS, 563/563; npm run check-cli PASS; git diff --check PASS.; Worker-code self-check: focused specs tests PASS, 63/63 (exact command not supplied); npm test PASS, 563/563; npm run check-cli and git diff --check PASS.; Independent proof covers schema-v1 output compatibility; v2 status-only and combined behavior; v1 CLI HEAD rejecting v2 before fixture record mutations; exact-H2 and last exact Status-line targeting; history, CRLF, and unrelated-byte preservation; invalid/no-write, rollback, idempotency, and output behavior; canonical/CLI skill mirror parity; Node >=22; no dependency or version change; and unchanged real .specs/state/known-issues.md.; No commit, push, tag, npm publish, release, or shipping occurred.
Change: .specs/changes/2026-10-20-spec-record-known-issue-status.md
<!-- guarana:record:end -->
