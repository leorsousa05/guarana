---
name: guarana:remember
description: Use when restoring or recording project workflow state, resuming work after context loss, or recovering a checkpoint. Reads only task-relevant `.specs` excerpts and persists durable progress to disk.
---

# guarana:remember

Project workflow state is on disk, not in context (hard truth 3, ADR-004). **Anything that exists only in a context window is treated as nonexistent.**

## Selective restore (not corpus injection)
1. Use `workflow_get` for operational state.
2. If `.specs/` exists, search `.specs/README.md` for the relevant tracker row;
   do not read the whole file when it is large or load every record.
3. Search for the task's matching feature and read only the relevant sections.
   Read a specific governing ADR or state excerpt only when the task needs it;
   never read `decisions/*` or all feature specs by default.
4. Give workers only the selected paths and applicable criteria. If there is no
   relevant record, proceed from the user request, source, and tests; do not
   create a placeholder during kickoff.

## Memory vault as an additional resume layer
The memory vault is separate from human-readable specs. Automatic prompt context
is limited to eligible confirmed preference records from the current project and
Global vault, under the shared budget; `memory.autoInject` is enabled by default
and can be disabled per scope. Other project knowledge and drafts are not
automatically injected. `memory_*` search/retrieval remains available on demand.

## Write triggers
1. **Task status:** record only a meaningful durable completion or material
   blocker/status change when it merits a human-readable record. Never create a
   project-state entry solely because a task started; do not record every stage.
2. **Actual build runs:** `guarana:build` Record always logs the run outcome and
   exactly one stop reason. Read-only questions, planning-only interactions, and
   other non-run turns do not get run records.
3. **ADR:** append only a durable architectural, contract, data, security, privacy,
   or integration decision that had material alternatives. Tactical implementation
   choices do not need ADRs; ADRs remain append-only.
4. **Known issue:** record only a confirmed, reproducible product failure with a
   useful durable mitigation. Do not record tool/verifier scope errors or transient
   permission/environment failures as product issues.

## Silent context truncation
Contexts truncate without warning. Defense:
- **Checkpoint:** keep transient stage, current-step, and budget details in
  operational workflow/run state; they do not belong in `state/project-state.md`.
- **Detect:** on restore, compare expected checkpoint (from your run position) with what's on disk.
- **Recover:** on mismatch or gap, re-read from disk. NEVER reconstruct missing facts from memory.

## Conflict rule
Disk vs. context conflict → disk wins, always.
