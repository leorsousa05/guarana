# Feature spec: Deterministic `.specs` Record Command

**Status: SHIPPED**

## Goal
Automate mechanical `.specs` tracker, checkpoint, and feature-status/proof receipt updates from a versioned JSON handoff, while leaving requirement discovery, acceptance decisions, and fact/proof formulation with `worker-specs` and its primary.

## Assumptions and boundaries
- One command only; no new dependencies.
- The worker continues to decide requirements/acceptance and formulate factual status/proof input. The script performs deterministic formatting and application only.
- Preserve existing requirement text and acceptance criteria; do not rewrite prose outside explicitly managed fields.
- This is a plan, not evidence of implementation.

## Schema v1 record contract
The command accepts one JSON object with this shape (optional fields are shown with `?`):

```json
{
  "schema": "v1",
  "task": {
    "slug": "string",
    "title": "string",
    "featurePath": "string",
    "trackerName": "string",
    "status": "SPECIFIED | TASKED | IMPLEMENTED | VALIDATED | SHIPPED",
    "goal": "string",
    "requirements": ["string"],
    "assumptions": ["string"],
    "scope": ["string"],
    "acceptanceCriteria": ["string"],
    "currentStep?": "string",
    "pendingWrites": ["string"],
    "next": "string",
    "proof": ["string"],
    "changePath?": "string",
    "verification?": {
      "independent": true,
      "result": "PASS",
      "verifier": "worker-verify"
    },
    "shipped?": true
  }
}
```

All listed non-optional task fields are required; `schema` must equal `v1`, arrays contain strings, and paths must satisfy the feature/change path constraints in acceptance criterion 1. `currentStep` is optional: omission preserves the stored `## Current step` content, while an explicit non-empty value retains the prior rendering behavior. `status` is exactly one of `SPECIFIED`, `TASKED`, `IMPLEMENTED`, `VALIDATED`, or `SHIPPED`. `VALIDATED` requires `verification.independent: true`, `verification.result: "PASS"`, `verification.verifier: "worker-verify"`, and at least one non-empty `proof` item. `SHIPPED` requires `shipped: true`. The command does not infer these gates or claim implementation/shipping.

Receipts are updated only inside the target feature's managed markers. For an existing feature, only its task status and managed receipt are updated; semantic sections, including requirements and acceptance criteria, remain unchanged. If the feature is absent, create it from the supplied goal, requirements, assumptions, scope, and acceptance criteria.

## Acceptance criteria
1. `guarana specs record --stdin` reads versioned JSON (`schema: v1`) from stdin and validates required fields, enums/status gates, and feature paths under `.specs/features/` before touching files.
2. It performs an idempotent upsert of the tracker by exact name plus `NEXT`, updates the checkpoint in `project-state.md`, and updates status/receipt content bounded by markers in the target feature spec. It does not rewrite acceptance criteria or prose outside managed fields.
3. It rejects invalid JSON, path traversal, absolute paths, non-feature paths, malformed names, and malformed Markdown table pipes. `VALIDATED` requires independent `worker-verify` PASS proof; `SHIPPED` requires explicit confirmation.
4. Writes are safe and all-or-nothing: if any target cannot be updated or the specs validator fails, restore all prior contents. Emit concise JSON containing paths and validator result.
5. Tests cover stdin/parser/schema, status gates, path/content protection, idempotency, and rollback. CLI help, `npm test`, `check-cli`, and specs validator all pass.
6. The `worker-specs` skill is instructed to emit this schema and invoke the command rather than manually editing these managed fields.
7. For schema-v1 records, `pendingWrites` updates the existing `- Pending writes:` checkpoint line: `['planning']` renders as `- Pending writes: planning`, multiple entries are all represented joined by `; `, and an empty array renders `none.`. The update preserves unrelated checkpoint lines and the existing `Current step` rendering semantics, reports `.specs/state/project-state.md` in `changed` when it changes, and a second identical call is idempotent. Tests cover these cases while existing structural validation and rollback behavior remain unchanged.
8. For schema-v1 records, omitting optional `currentStep` preserves the stored `## Current step` content; supplying a non-empty value retains the prior rendering behavior. Tests cover omission and explicit values without changing pendingWrites, idempotency, or rollback behavior.

## Follow-up: project-state Last updated refresh
The recorder currently updates the project-state checkpoint without refreshing the mechanical top-level `Last updated:` field. This bounded follow-up adds the timestamp refresh to task-recording operations while retaining the established record and CLI contracts.

9. For a schema-v1 task or combined schema-v2 task-plus-issue recording, refresh the single top-level `Last updated:` value to a pure ISO 8601 timestamp when and only when the recorder's other mechanical project-state updates change the file. Replace the whole value; if the field is absent, insert it after `# Project State`.
10. An identical replay does not rewrite the timestamp or report project-state as changed. A status-only schema-v2 known-issue update does not modify project-state or its timestamp.
11. Preserve unrelated project-state bytes and line-ending style outside managed timestamp, checkpoint, and current-step fields; report changed paths accurately and include the timestamp in all-or-nothing rollback.
12. Do not change the schema or CLI JSON contract, or make unrelated code or record edits. Focused tests prove timestamp refresh on a changed project-state file, pure ISO value replacement, insertion when absent, replay stability, status-only schema-v2 no-touch, and rollback preservation. Preserve optional-currentStep, pendingWrites, schema-v2, and existing dirty worktree changes.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: Final independent worker-verify result: PASS on all 5 criteria (AND verdict).; node --test cli/commands/specs.test.js: 31 passed, 0 failed.; git diff --check: exit 0, no output.; node bin/guarana.js specs validate . --json: ok:true; 195 files scanned, 72 feature specs, 35 ADRs, 214 links, issues: [].; Timestamp replacement/insertion and v1/combined-v2 refresh: cli/lib/spec-record.js:40-59,285-292; tests cli/commands/specs.test.js:374-422,526-544.; Replay stability and status-only isolation: cli/commands/specs.test.js:401-404,485-523.; CRLF replacement and trailing-byte insertion: cli/commands/specs.test.js:322-372.; Rollback and compatibility: cli/commands/specs.test.js:230-245,291-320,424-473,526-590.
Change: none
<!-- guarana:record:end -->
