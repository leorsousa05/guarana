---
name: guarana:plan
description: Use when starting any task, resuming a session, deciding the next step, or choosing which guarana skill applies. Restores state from disk, classifies intent, and dispatches a worker with a verifiable condition and budget.
---

# guarana:plan

The meta-skill. The main thread holds this plus the suite index — nothing else.

## 1. Restore state (always, in this exact order)
1. `.specs/README.md` — master tracker (DONE/NEXT/BLOCKED).
2. `.specs/state/project-state.md` — per-skill status, current step.
3. `.specs/decisions/ADR-*.md` — append-only decisions.
4. The current feature spec in `.specs/features/guarana/`.
Never reconstruct state from memory. Disk is truth (ADR-004).

### Cold start (no `.specs/` on disk)
If restore finds no `.specs/`, that is a signal, not an error:
1. Do NOT fabricate a current step or restore from memory.
2. Check for a recoverable legacy spec tree — a `specs/` directory in the working tree, or `.specs/` content recoverable from git HEAD (files deleted or renamed in the working tree):
   - **(i) Legacy tree recoverable (migration).** Do NOT discard it. Recover the legacy content as the project's initial Core feature spec context, then scaffold the new `.specs/` system of record around it. Treat this as a migration, not a from-scratch cold start.
   - **(ii) No prior state anywhere (pure cold start).** Bare scaffold + Rule-0 ADRs only.
3. Scaffold the initial system of record: `.specs/README.md` master tracker (DONE/NEXT/BLOCKED), `.specs/state/project-state.md` (current step, checkpoint, budgets), and `.specs/decisions/` — created EMPTY. Do NOT copy or pre-seed ADRs from any other project or template (e.g. a guarana baseline); ADRs are generated ONLY from this project's actual Rule-0 answers, numbered organically from 001.
4. Bootstrap via Rule 0 (ADR-006): ask the human the contract questions (package, runtime, conventions, verifier, budget, acceptance gate); record each answer, deferred or rejected, as an ADR in `.specs/decisions/ADR-*.md`.
Only after `.specs/` exists on disk does "disk is truth" (ADR-004) apply. Then proceed to routing (section 2).

## 2. Classify intent → route to exactly ONE skill
| User intent | Route |
|---|---|
| Starting/planning work, "what next", routing itself | guarana:plan (stay here) |
| Run a cycle, execute with budget, stop conditions | guarana:build |
| Implement, edit, write code | guarana:code |
| Check work, pass/fail, "is it done" | guarana:verify |
| State, memory, resume, context loss | guarana:remember |
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
