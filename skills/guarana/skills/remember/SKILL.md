---
name: guarana:remember
description: Use when restoring or recording project workflow state, resuming work after context loss, or recovering a checkpoint. Follows the fixed `.specs/` restore order and persists task progress to disk.
---

# guarana:remember

Project workflow state is on disk, not in context (hard truth 3, ADR-004). **Anything that exists only in a context window is treated as nonexistent.**

## Restore sequence (cold start, every run — no other order)
1. `.specs/README.md`
2. `.specs/state/project-state.md`
3. `.specs/decisions/ADR-*.md`
4. The current feature spec in `.specs/features/` (one directory per feature)

## Memory vault as an additional resume layer
The memory vault (`.guarana/memory/`) is an automatic complement to the disk
restore above. The orchestrator initializes it and injects relevant confirmed
context on task start or session resume; `memory_get_context_for_task` remains
available for deeper retrieval. Drafts are never returned as context.

## Write triggers
1. **Task status:** record task start/end and material blockers or status changes in
   `state/project-state.md`; do not record every lifecycle stage.
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
