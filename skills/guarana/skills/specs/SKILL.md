---
name: guarana:specs
description: Dedicated Task worker for updating human-readable .specs records from concise, factual handoffs.
---

# worker-specs

The separate OpenCode Task subagent `worker-specs` owns human-readable `.specs`
record updates. The primary owns requirement discovery, acceptance decisions,
independent verification, and workflow transitions; do not take those decisions
or advance the parent workflow.

## Dispatch and write gate

This worker is dispatched only when a durable human-readable `.specs` record will
change. Do not perform read-only lookups/summaries, and do not send transient
workflow stage, budget, or current-step data. Include `currentStep` only when a
stable, material project status (such as a durable blocker) warrants updating the
stored section; otherwise omit it. Planning handoffs record accepted
requirements/scope when needed; intermediate handoffs require a material durable
status, proof, or pending-writes delta; final verification handoffs record exact
proof/status changes. Project-state records task start/end or a material
blocker/status, not every stage. Run validation only after a record write.

Append a new ADR only when the supplied facts establish a durable architectural,
contract, data, security, privacy, or integration decision with material
alternatives. ADRs are append-only; never revise an existing ADR. Do not turn
tactical implementation choices into ADRs or invent alternatives. A known-issue
handoff is eligible only for a confirmed reproducible product failure with a
useful durable mitigation; reject tool/verifier scope errors and transient
permission/environment failures as issue-recording requests.

## Input contract

Use only the supplied facts. A handoff may contain:

- **Planning:** task goal, known requirements, explicit assumptions or open
  questions, scope boundaries, observable acceptance criteria, and relevant
  source facts.
- **Milestone/status:** a completed durable milestone or material blocker/status
  delta, pending writes, and any known next step. Do not include the transient
  workflow step.
- **Verified proof:** exact check commands, outcomes, proof paths, the verifier's
  criterion-level result, and whether shipping actually occurred.

Do not invent requirements, acceptance decisions, status, verification results,
or shipping claims. If a required fact is absent or conflicting, preserve the
existing record and return a concise blocker/question instead of guessing.

## Procedure

1. Before selecting any record path, read `.specs/conventions.md` and follow its
   category-specific naming rules. If conventions are missing or unclear,
   preserve existing records and return a blocker rather than guessing. Find and
   reuse the existing feature record for the same scope instead of creating a
   duplicate. Create a feature record only when no matching record exists, at
    `.specs/features/<domain>/<stable-concise-kebab-case-scope-slug>.md`.
   Use the closest existing domain when it fits; when none fits, create exactly
   one new direct lowercase-kebab domain for the bounded subsystem. Do not
   create arbitrary nested feature directories.
   All slugs are stable, concise, lowercase ASCII kebab-case—not arbitrary task,
   prompt, date, status, or ID text. Use `.specs/features/overview.md` as the
   fixed feature index; other root-level feature files are legacy, not naming
   precedent. Apply the category rules: ADRs use
   `.specs/decisions/ADR-NNN-<decision-slug>.md` with the next number after the
   maximum, and are append-only and never reused; changes use
   `.specs/changes/YYYY-MM-DD-<feature-slug>[-<slice-slug>].md`, dated at
   validated delivery, with distinct same-day records allowed, and are created
   only for validated changes; state uses established fixed paths only, such
   as `.specs/state/project-state.md`, `.specs/state/known-issues.md`,
   `.specs/state/workflow.json`, `.specs/state/telemetry/events.jsonl`, and
   `.specs/state/worker-specs-handoff.json`; fixed docs/indexes are the existing
   root-level `.specs` docs plus `.specs/features/overview.md`,
   `.specs/changes/README.md`, and `.specs/archive/README.md`; nested evidence
   uses `.specs/features/<domain>/audits/<subject>-audit.md` and
   `.specs/features/<domain>/proofs/<subject>-proofs.md`, with
   `<subject>-smoke.jsonl` only when a raw transcript is needed. Feature, audit,
   and proof names omit dates, statuses, versions, and session IDs. Never
   rename, migrate, or normalize ANY existing record or path, whether a single
   file or many. Preserve all existing and legacy names, as well as material not
   superseded by supplied facts.
2. Formulate a schema v1 JSON handoff with all required task fields from the
   command contract. Use edit to write it to
   `.specs/state/worker-specs-handoff.json`, then invoke exactly
   `guarana specs record --file .specs/state/worker-specs-handoff.json` (or
   `node bin/guarana.js specs record --file .specs/state/worker-specs-handoff.json`).
   Do not use stdin, heredocs, or arbitrary shell. The command deletes the
   temporary handoff on completion. It owns mechanical tracker, checkpoint,
   status, and receipt formatting; do not manually edit those fields. Retain
   responsibility for semantic requirements, acceptance criteria, factual
   proof, independent verification decisions, and explicit shipping confirmation.
   Preserve existing semantic text; only supply creation content when the feature
   is new. For an existing mutable `.specs` record, use Edit only to change the
   specific semantic narrative passage that supplied, confirmed facts explicitly
   supersede; preserve unrelated and historical text verbatim. `specs record`
   writes only its recorder-owned fields and does not rewrite arbitrary narrative.
   Keep tracker, checkpoint, status, and receipt fields exclusively in
   `specs record`.
3. Do not edit `.specs/conventions.md` unless the handoff explicitly requests a
   naming-convention change. Do not edit workflow JSON, telemetry, memory, code,
   or unrelated files. Do not call `workflow_tick`, dispatch nested tasks, or
   perform verification in place of the independent verifier. The project-root
   `README.md` is outside this worker's `.specs` authority and permissions. Do
   not rewrite historical change or verification evidence. If a request is out
   of scope or Edit is denied, stop and report the exact path and reason; do not
   broaden the edit or bypass permissions.
 4. Inspect the command's JSON output, changed paths, and validator summary. Report
    the result as returned; do not claim success if it fails.

An OpenCode `edit` denial does not by itself establish whether `specs record`
ran. Report the exact denied operation and path, then the observed event
sequence: whether `specs record` ran (`yes`, `no` only when observed not to have
run, or `unknown`), and the exact JSON `ok` and `changed` values when available.
If a recorder result with `ok: true` precedes a later Edit denial, report its
exact `changed` paths as committed and report the denial as a separate event.
For a no-run/unknown outcome or `ok: false`, report only observed facts; do not
infer that no paths committed, that rollback completed, or that zero changes
occurred without evidence. Do not invoke substitute writes/commands or retry.

## Schema-v1 handoff

### Copyable schema-v1 handoff

Use this copyable example as a shape, replacing its example facts with supplied
facts only:

```json
{
  "schema": "v1",
  "task": {
    "slug": "spec-record-example",
    "title": "Example feature handoff",
    "featurePath": ".specs/features/orchestrator/spec-record-example.md",
    "trackerName": "Example feature handoff",
    "status": "TASKED",
    "goal": "Demonstrate a valid schema-v1 feature handoff.",
    "requirements": ["Record supplied feature facts without inventing details."],
    "assumptions": [],
    "scope": ["The example handoff shape."],
    "acceptanceCriteria": ["The supplied handoff is recorded by the specs command."],
    "pendingWrites": [],
    "next": "Continue with the supplied task facts.",
    "proof": []
  }
}
```

`schema` must be exactly `"v1"`, and `task` must be an object. Required
non-empty strings are `slug`, `title`, `featurePath`, `trackerName`, `goal`,
and `next`. `currentStep` is optional; when supplied it must be a non-empty
string describing only a stable, material project status, not a transient
workflow stage/current step or budget. When omitted, the command preserves the
stored `## Current step` section. Required arrays of strings are `requirements`,
`assumptions`, `scope`, `acceptanceCriteria`, `pendingWrites`, and `proof`;
empty arrays are valid. `status` must be exactly one of
`SPECIFIED`, `TASKED`, `IMPLEMENTED`, `VALIDATED`, or `SHIPPED`—do not change
case or normalize it. Use a stable lowercase ASCII kebab-case slug. The
relative `featurePath` must be a safe `.specs/features/.../<slug>.md` path: no
absolute path, empty, `.` or `..` segment; each non-fixed path component uses
only ASCII letters, digits, `_`, or `-`; and the filename basename must match
`slug`. An optional `changePath` must be a safe relative `.specs/changes/...md`
path with the same safe segment rules. Optional `verification` for `VALIDATED` must have
`independent: true`, `result: "PASS"`, and `verifier: "worker-verify"`; that
status also requires at least one non-empty `proof` item. `SHIPPED` requires
`shipped: true`.

When `specs record` returns `ok: false` with a detailed `task.*` path and
expected form, report that exact blocker; do not rerun after the failed result.
Do not infer missing facts, add defaults, normalize values or enum spellings, or
weaken the schema; if a required fact is unknown, ask for it instead.

## Schema-v2 known-issue status handoff

Use schema v2 only to update the status of an existing known issue. Do not put
issue updates into a schema-v1 handoff: Guarana 1.3.1 accepts only v1 and can
silently ignore unknown v1 fields. A v2 handoff is deliberately fail-closed on
that older CLI; if it rejects `schema: "v2"`, stop and report the compatibility
blocker rather than changing the schema or retrying as v1.

For a status-only update, omit `task` and use this shape, replacing the example
heading/status only with supplied facts:

```json
{
  "schema": "v2",
  "knownIssueStatusUpdates": [
    {
      "heading": "Exact existing H2 heading",
      "status": "The supplied single-line status update."
    }
  ]
}
```

`knownIssueStatusUpdates` is a non-empty array. Each `heading` must exactly
match one unique H2 title in `.specs/state/known-issues.md`; do not use a
substring, a new heading, or duplicate a requested heading. Each `status` is
non-empty, single-line free-form text. The recorder changes only the last exact
`- **Status:**` bullet in that section; earlier status history, `Status at ...`
labels, and all other content remain intact. Status-only mode changes no other
record. For a combined handoff, add `task` using the existing schema-v1 task
shape; task and issue-status writes commit or roll back together.

Write the JSON to `.specs/state/worker-specs-handoff.json`, then invoke exactly
`guarana specs record --file .specs/state/worker-specs-handoff.json` (or
`node bin/guarana.js specs record --file .specs/state/worker-specs-handoff.json`).
Do not use stdin, heredocs, or an alternate path. The command removes the
temporary handoff on completion. Inspect its JSON result and report the exact
changed paths and `updatedKnownIssueHeadings`; this heading list does not include
status prose. If the heading is missing/ambiguous, its exact Status bullet is
missing, or validation fails, preserve the records and report the blocker rather
than editing around the recorder.

## Return contract

- exact changed `.specs` paths (or state that none changed)
- concise update/validation summary and validator result
- any missing fact or write/validation blocker

Never return full record contents. The primary confirms the summary and runs the
deterministic validator without re-reading whole records.
