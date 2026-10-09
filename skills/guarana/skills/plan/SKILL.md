---
name: guarana:plan
description: Use automatically when a task starts or resumes. Restores state, checks requirements for consequential gaps, asks targeted questions before coding when needed, then dispatches with a verifiable condition and budget.
---

# guarana:plan

The meta-skill. The automatic orchestrator enters this step for every new or
resumed task; the user does not need to mention `guarana:plan`.

## 1. Restore state

Use `workflow_get` for operational state. For human-readable project records,
ask `worker-specs` for a concise factual summary when required; do not read whole
`.specs` files or edit records in the primary context. Never reconstruct state
from memory. Disk is truth (ADR-004).

## Memory
The orchestrator initializes the project vault and automatically supplies
relevant confirmed context on task start and resume. Draft atoms remain
quarantined. Use the `memory_*` tools for deeper retrieval, review, or explicit
decisions; a completed verified run is recorded automatically.

### Cold start (no `.specs/` on disk)
The orchestrator creates a minimal `.specs/` shell before planning. Existing files
are never replaced, and no project-specific ADR is fabricated. The primary
determines requirements and acceptance; `worker-specs` records only those supplied
facts. Ask only for contract facts that cannot be inferred.

## System-of-record writes (mandatory)

The workflow JSON is operational state, not a substitute for the human-readable
`.specs/` record. The primary owns requirements, acceptance decisions, independent
verification, and workflow transitions. It does not read whole `.specs` records
or edit them; `worker-specs` reads and updates the records from concise factual
handoffs. A task is not planned until the worker reports its writes and validator
result; calling `workflow_tick` alone never completes planning.

1. **During planning, before `plan_complete`:** after closing the requirements
   discovery gate, dispatch `worker-specs` a compact handoff containing the task
   goal, known requirements, explicit assumptions/open questions, scope
   boundaries, and observable acceptance criteria. Criteria must distinguish a
   correct result from a plausible but wrong one. The worker assigns/repairs the
   task-specific feature record and updates the tracker and project-state while
   preserving unrelated records. Wait for changed paths and validator status.
2. **At each lifecycle milestone before `workflow_tick`:** dispatch only the
   completed milestone, current/next step, status delta, and pending writes to
   `worker-specs`. The primary advances the workflow only after the worker returns
   its changed-path and validator summary.
3. **After independent verification:** dispatch the exact verified checks,
   outcomes, and proof paths to `worker-specs`. It updates the feature proof and
   tracker status; `VALIDATED` requires a passing independent result, and
   `SHIPPED` requires explicit confirmation. The primary runs
   `guarana specs validate . --json` and does not inspect whole records.
4. Never let the worker infer missing facts or fabricate proof. If a write or
   validation fails, report the blocker and do not describe the task as fully
   recorded.

## Requirements discovery gate (before any code dispatch)

Do not treat a user's first sentence as a complete specification for a substantial
or ambiguous change. First inspect the relevant implementation, project
conventions, and confirmed memory; request a concise `.specs` summary from
`worker-specs` when record facts are needed. Then make a short requirements ledger:

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
- **Worker:** worker-code | worker-verify | worker-debug | worker-specs
- **Mechanism:** invoke that named OpenCode subagent through the native Task tool; do not relabel same-context work as a worker dispatch.
- **Verifiable condition:** the exact checkable predicate defining done
- **Budget:** per ADR-005 (code 8k / verify 4k / debug 6k tokens)
- **State pointers:** relevant record paths and the factual delta; `worker-specs`
  reads/updates human-readable `.specs` records only

The primary context passes the dispatch contract, waits for the Task return, and
advances workflow state. If Task is unavailable or denied, report the blocker
instead of doing the worker's procedure in the primary context.

Before a worker-code dispatch, confirm the requirements discovery gate above is
closed and the acceptance condition has been decided by the primary and recorded
by `worker-specs`.

## 4. Stop
After dispatch, wait for the worker summary. Do not hold record detail in the main
thread; durable facts go to disk, not summaries. Before leaving planning, confirm
the worker reported the acceptance condition and tracker/project-state updates,
then run the specs validator without reading whole records.
