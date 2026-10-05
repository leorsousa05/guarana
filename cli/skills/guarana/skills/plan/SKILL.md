---
name: guarana:plan
description: Use automatically when a task starts or resumes. Restores state, checks requirements for consequential gaps, asks targeted questions before coding when needed, then dispatches with a verifiable condition and budget.
---

# guarana:plan

The meta-skill. The automatic orchestrator enters this step for every new or
resumed task; the user does not need to mention `guarana:plan`.

## 1. Restore state (always, in this exact order)
1. `.specs/README.md` — master tracker (DONE/NEXT/BLOCKED).
2. `.specs/state/project-state.md` — per-skill status, current step.
3. `.specs/decisions/ADR-*.md` — append-only decisions.
4. The current feature spec in `.specs/features/` (one directory per feature).
Never reconstruct state from memory. Disk is truth (ADR-004).

## Memory
The orchestrator initializes the project vault and automatically supplies
relevant confirmed context on task start and resume. Draft atoms remain
quarantined. Use the `memory_*` tools for deeper retrieval, review, or explicit
decisions; a completed verified run is recorded automatically.

### Cold start (no `.specs/` on disk)
The orchestrator creates a minimal `.specs/` system of record and a
task-specific feature spec before planning. Existing files are never replaced,
and no project-specific ADR is fabricated. The plan worker fills in the
acceptance condition and asks only for contract facts that cannot be inferred.
Only after `.specs/` exists on disk does "disk is truth" (ADR-004) apply.

## System-of-record writes (mandatory)

The workflow JSON is operational state, not a substitute for the human-readable
`.specs/` record. Read and write both. A task is not planned until the files on
disk reflect the task; calling `workflow_tick` alone never completes planning.

1. **During planning, before `plan_complete`:** replace bootstrap placeholders
   with the real task. Give the feature directory/file a task-specific slug;
   update its goal, known requirements, explicit assumptions/open questions,
   scope boundaries, and observable acceptance criteria. Criteria must be
   specific enough to distinguish a correct result from a plausible but wrong
   one; do not leave text such as "implement requested behavior". Update
   `.specs/README.md` (`NEXT` and tracker row) and
   `.specs/state/project-state.md` (goal, acceptance condition, current step,
   and pending writes). Preserve unrelated project records and existing ADRs.
2. **At each lifecycle transition:** update project-state checkpoint and pending
   writes to match the active step. Keep the feature spec status in sync (planned,
   implemented, validated); do not claim validation before independent checks.
3. **After verification:** write the exact checks and outcomes as proof in the
   feature spec, mark the tracker `VALIDATED` (and `SHIPPED` only when actually
   shipped), update `DONE`/`NEXT`/`BLOCKED` and project-state, then inspect the
   resulting diff to confirm the records were actually changed.
4. If an existing spec is missing, stale, or uses a generic bootstrap, repair it
   in place before proceeding. Never overwrite unrelated content or fabricate
   proof. If a write fails, report the blocker and do not describe the task as
   fully recorded.

## Requirements discovery gate (before any code dispatch)

Do not treat a user's first sentence as a complete specification for a substantial
or ambiguous change. First inspect the relevant implementation, specs, project
conventions, and confirmed memory. Then make a short requirements ledger:

- **Known:** facts stated by the user or established by repository evidence.
- **Inferred:** low-risk defaults that follow from existing patterns.
- **Unknown:** decisions that cannot be safely inferred.

Ask the human when an unknown could materially change scope or architecture,
user-visible behavior, data shape/migration, integrations, security/privacy,
operational constraints, or the acceptance gate. For greenfield or multi-surface
work, explicitly check the desired outcome, in/out of scope, key users/flows,
constraints/integrations, and what observable result counts as done.

Question policy:
1. Investigate before asking; never ask for facts the repo/specs already answer.
2. Ask a small, coherent batch of the highest-impact questions (up to five per
   round). Use the question tool when available; otherwise ask plainly in chat.
3. Do not ask questions just to appear thorough. A precise, low-risk task proceeds
   without a questionnaire; record only assumptions that affect the implementation.
4. **Do not dispatch worker-code or begin implementation while a critical unknown
   remains unanswered.** Wait for the human, incorporate the answer, and record
   durable requirements in the feature spec; record a durable project decision in
   an ADR when needed.
5. If the human explicitly authorizes assumptions, write them down with their
   consequence and proceed only when the acceptance condition remains falsifiable.

Discovery is complete when the outcome, boundaries, constraints, and acceptance
condition are concrete enough to reject an incorrect implementation. Non-critical
unknowns may remain as explicit, reversible assumptions.

## 2. Classify intent → route to exactly ONE skill
| User intent | Route |
|---|---|
| Starting/planning work, "what next", routing itself | guarana:plan (stay here) |
| Run a cycle, execute with budget, stop conditions | guarana:build |
| Implement, edit, write code | guarana:code |
| Check work, pass/fail, "is it done" | guarana:verify |
| State, memory, resume, context loss | guarana:remember |
| Using/querying the memory vault; recovering prior decisions/bugs | guarana:memory |
| A test FAILED or a run misbehaves | guarana:debug (optional — only now) |
| Cost tuning, telemetry, stop-reason stats | guarana:measure (optional — only now) |

Ambiguous intent → ASK the human (Rule 0). Never guess a route. Never load debug or measure without their trigger.

## 3. Dispatch template (every dispatch, no exceptions)
- **Worker:** worker-code | worker-verify | worker-debug
- **Verifiable condition:** the exact checkable predicate defining done
- **Budget:** per ADR-005 (code 8k / verify 4k / debug 6k tokens)
- **State pointers:** which `.specs/` files the worker reads and may append to

Before a worker-code dispatch, confirm the requirements discovery gate above is
closed and the feature spec contains a checkable acceptance condition.

## 4. Stop
After dispatch, wait for the worker summary. Do not hold worker detail in the main thread; durable facts go to disk, not summaries. Before leaving planning, verify that the feature spec contains the concrete acceptance condition and that `.specs/README.md` and `state/project-state.md` point to this task.
