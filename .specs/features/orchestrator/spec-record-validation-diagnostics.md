# Feature spec: Specs Record Validation Diagnostics and Guidance

**Status: VALIDATED**

## Goal
Diagnose and reduce recurring failures across projects where guarana specs record reports that schema v1 required fields or enums are invalid, without claiming a root cause for prior occurrences lacking the failing payload and CLI version.

## Requirements
- Preserve the schema-v1 accepted payload, exact status enum values SPECIFIED, TASKED, IMPLEMENTED, VALIDATED, and SHIPPED, path safety, VALIDATED and SHIPPED verification gates, transaction and rollback behavior, no silent defaults or coercion, and the JSON output envelope.
- Replace the generic initial structural-validation error with deterministic, actionable diagnostics naming precise JSON paths and expected types or allowed status values for every initial-guard failure; do not echo submitted values or payload content.
- Keep unrelated path-validation and status-gate error behavior unchanged.
- Add a canonical, valid, copyable schema-v1 JSON example and field-by-field required fields, enums, safe path and slug rules, status gates, and instructions to use detailed error paths to correct only the handoff.
- Keep the canonical skills/... guarana:specs skill and generated CLI mirror synchronized.
- Do not weaken the API/schema contract; do not version, publish, commit, push, globally install, use external services, or change unrelated work.

## Assumptions and scope
- No failing payload or exact other-project CLI version was supplied; no root cause is assigned to any prior occurrence.
- The existing .specs/features/orchestrator/spec-record-command.md remains historically VALIDATED; its status and proof are not to be rewritten.
- Structural diagnostics in cli/lib/spec-record.js and focused regression tests.
- Canonical and generated CLI mirror guarana:specs skill guidance and copyable schema example.
- Preserve unrelated files and existing command behavior outside the initial structural guard.

## Acceptance criteria
1. Each initial schema-v1 structural-validation failure produces a deterministic diagnostic with the precise JSON path and expected type or allowed status values: schema, task object, each required non-empty string field (slug, title, featurePath, trackerName, goal, currentStep, next), status, each required string-array field (requirements, assumptions, scope, acceptanceCriteria, pendingWrites, proof), and each non-string array element by index. Missing or blank strings, wrong schema or task types, invalid status values, malformed arrays, and non-string indexed elements are individually identifiable; diagnostics do not echo arbitrary submitted values or payload fragments.
2. Valid handoffs still record under the existing schema-v1 contract and JSON output envelope; accepted enums, safe paths, verification and shipping gates, transaction and rollback, and no-default/no-coercion behavior remain unchanged. Malformed handoffs leave target records byte-identical, and unrelated path and status-gate errors retain their existing behavior.
3. The canonical guarana:specs skill contains a valid copyable schema-v1 JSON example, required and optional fields, exact status enums, safe path and slug guidance, VALIDATED and SHIPPED gates, and directions to use diagnostic paths to correct only the handoff; its generated CLI mirror is byte-identical.
4. Focused tests prove deterministic actionable diagnostics for every initial-guard category, no mutation of target records on malformed payloads, no echo of arbitrary submitted values, and unchanged recording for valid handoffs.
5. Focused tests, npm test, npm run check-cli and build/sync, specs validation, and git diff --check pass; independent worker-verify passes all five criteria. This follow-up is VALIDATED only, not SHIPPED; shipping requires separate explicit confirmation.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall PASS, 5/5 criteria. Criterion 1 PASS: deterministic field-path/type and enum diagnostics, indexed non-string array paths, no echo of submitted values, and unchanged invalid-JSON and JSON envelope behavior; evidence cli/lib/spec-record.js:11–50 and cli/commands/specs.test.js:242–309,333–351.; Criterion 2 PASS: no coercion or contract weakening; safe paths and VALIDATED/SHIPPED gates remain at cli/lib/spec-record.js:51–57; valid idempotent upserts, path safety, gates, and rollback passed. Canonical specs-skill example passed current CLI at cli/commands/specs.test.js:312–331; canonical and CLI mirror byte-identical.; Criteria 3/4 PASS: malformed payloads leave all three target records byte-identical; tests cover diagnostics, status gates, rollback, valid idempotency, no echo, and mirror equality. node --test cli/commands/specs.test.js cli/commands/specs-parser.test.js passed 23/23; npm test passed 487/487.; Criterion 5 PASS: npm run check-cli passed (CLI bundle matches canonical sources); npm run build passed (dashboard build plus CLI sync); git diff --check passed; final guarana specs validate . --json returned ok:true, 184 files scanned, 67 features, 30 ADRs, 209 links, zero issues.; No actual failing payload/version from other projects was supplied, so no cause of prior incidents is claimed. No source, workflow, version, release, commit, push, install, or publish action occurred; build regenerated dashboard assets as expected; unrelated pending changes were preserved.
Change: none
<!-- guarana:record:end -->
