---
name: guarana:plan
description: Use automatically when a task starts or resumes. Restores state from disk, creates missing specs, uses relevant memory, dispatches a worker with a verifiable condition and budget, and persists the plan.
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

## 4. Stop
After dispatch, wait for the worker summary. Do not hold worker detail in the main thread; durable facts go to disk, not summaries.
