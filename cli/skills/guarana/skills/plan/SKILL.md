---
name: guarana:plan
description: Use automatically when a task starts or resumes. Restores state, checks requirements for consequential gaps, asks targeted questions before coding when needed, then dispatches with a verifiable condition and budget.
---

# guarana:plan

The meta-skill. The automatic orchestrator enters this step for every new or
resumed task; the user does not need to mention `guarana:plan`.

## 1. Restore state

Use `workflow_get` for operational state. Inspect only relevant excerpts from
human-readable project records when needed; do not load whole `.specs` files or
edit records in the primary context. Never reconstruct state from memory. Disk is
truth (ADR-004).

## Memory
The orchestrator initializes the project vault and automatically supplies
relevant confirmed context on task start and resume. Draft atoms remain
quarantined. Use the `memory_*` tools for deeper retrieval, review, or explicit
decisions; a completed verified run is recorded automatically.

### Cold start (no `.specs/` on disk)
The orchestrator creates a minimal `.specs/` shell only for a clear mutation request
or explicit workflow-skill command. Informational questions, audits, reviews,
inspections, investigations, and reports without a requested repository mutation
stay read-only and create no task spec, tracker, or project-state entry. Existing
files are never replaced, and no project-specific ADR is fabricated. The primary
determines requirements and acceptance; `worker-specs` records only supplied facts.

## System-of-record writes (mandatory)

The workflow JSON is operational state, not a substitute for a human-readable
`.specs/` record. The primary owns requirements, acceptance decisions, independent
verification, and workflow transitions. It does not edit `.specs` records;
`worker-specs` owns durable record changes from concise factual handoffs. Dispatch
it only when a human-readable record will materially change—not for a read-only
summary or an operational stage update. A task is not planned until any required
record write is reported; calling `workflow_tick` alone never completes planning.

1. **Planning:** when accepted task requirements or feature scope need a durable
   record, dispatch `worker-specs` a compact handoff with the goal, known
   requirements, explicit assumptions/open questions, boundaries, and observable
   acceptance criteria. Criteria must distinguish a correct result from a plausible
   but wrong one. The worker reuses or creates the feature record and updates the
   tracker/project-state only for supplied durable task facts. Wait for changed
   paths and validator status before closing planning. Once discovery is closed
   and any required record write is reported, use `workflow_tick` action
   `start_task` with explicit nonempty goal and condition. This completes the
   planned stage transitions; it does not skip this skill. Keep `plan_complete`
   available for genuinely open/partial planning and other individual transitions.
2. **Intermediate milestones:** dispatch only when a material durable
   status/proof/pending-writes delta must be recorded. Do not dispatch for every
   lifecycle transition; stage, budget, and current-step data belongs in operational
   workflow/run state. Project-state records task start/end or a material
   blocker/status, not stage-by-stage progress.
3. **After independent verification:** when proof or status will change, dispatch
   the exact verified checks, outcomes, and proof paths. `VALIDATED` requires a
   passing independent result; `SHIPPED` requires explicit confirmation. Run
   `guarana specs validate . --json` only after a human-readable record write.
4. Never let the worker infer missing facts or fabricate proof. If a required write
   or validation fails, report the blocker and do not describe the task as fully
   recorded.

### ADR threshold

Record an ADR only for a durable architectural, contract, data, security, privacy,
or integration decision with material alternatives. Tactical implementation
choices do not need ADRs; describe rejected alternatives so the decision is
reviewable.

## Requirements discovery gate (before any code dispatch)

Do not treat a user's first sentence as a complete specification for a substantial
or ambiguous change. First inspect the relevant implementation, project
conventions, and confirmed memory; inspect only relevant record facts when
needed—do not dispatch `worker-specs` as a read-only lookup. Then make a short
requirements ledger:

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
   Check feasible supported evidence sources and their scope/access limits first.
2. Ask a small, coherent batch of the highest-impact questions (up to five per
   round). Use the question tool when available; otherwise ask plainly in chat.
3. Do not ask questions just to appear thorough. A precise, low-risk task proceeds
   without a questionnaire; record only assumptions that affect the implementation.
4. **Do not dispatch worker-code or begin implementation while a critical unknown
   remains unanswered.** Wait for the human, incorporate the answer, and record
   durable requirements in the feature spec; record a qualifying durable project
   decision in an ADR only when it meets the ADR threshold above.
5. If the human explicitly authorizes assumptions, write them down with their
   consequence and proceed only when the acceptance condition remains falsifiable.
6. Ask for permission only when a real privileged access decision is required;
   routine authorized safe steps do not need user approval.

Discovery is complete when the outcome, boundaries, constraints, and acceptance
condition are concrete enough to reject an incorrect implementation. Non-critical
unknowns may remain as explicit, reversible assumptions.

### Evidence/source map

For each material acceptance criterion, identify the expected proof source before
implementation: the criterion, authoritative source, supported alternative source
if available, and any access/scope limit. Prefer direct repository artifacts,
official/system-of-record output, or user-provided records according to the
criterion. Search feasible supported sources before asking; a scoped empty result
does not establish absence. Distinguish what is not checked from what cannot be
accessed in this context.

Ask only when a material decision cannot be safely inferred or actual privileged
access/permission is required. Do not ask the user to approve routine, authorized
safe inspection or work. Never bypass a denied tool or security/policy boundary.

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

## Parallel work planning

Keep the ordinary path sequential: one verifiable condition is one worker dispatch.
Do not create a DAG just because parallel tools are available. Plan a primary-owned
DAG only when the work contains at least two separately falsifiable subtasks whose
dependency edges and non-overlapping repository ownership can be stated in advance.
The DAG is created during a coding workflow after `run_start`; it does not replace
requirements discovery or required records.

- Assign `mode: read-only` only to bounded research with no file or state writes;
  dispatch that condition to `worker-research`, whose canonical procedure is
  strictly read-only. Assign `mode: code` to implementation conditions and
  `worker-code` only. Never route a read-only task to a code worker or a code task
  to a research worker.
- Give every subtask a stable ID, one nonempty goal, one falsifiable condition,
  explicit dependency IDs (or none), and owned paths. Read-only research uses an
  empty `ownedPaths` list; code tasks declare their exact repo-relative paths.
  Keep code ownership disjoint (including nested paths) across concurrent tasks.
- Keep worker outputs, instructions, and prose out of the persisted DAG; pass each
  exact task goal/condition only when dispatching it. The primary retains acceptance,
  decisions, review, integration, and workflow transitions.

## 3. Dispatch template (every dispatch, no exceptions)
- **Worker:** worker-code | worker-research | worker-verify | worker-debug | worker-specs (only for a durable human-readable record change)
- **Mechanism:** invoke that named OpenCode subagent through the native Task tool; do not relabel same-context work as a worker dispatch.
- **Verifiable condition:** the exact checkable predicate defining done
- **Budget:** per ADR-005 (code 8k / research 4k / verify 4k / debug 6k tokens)
- **State pointers:** relevant record paths and the factual delta; `worker-specs`
  reads/updates human-readable `.specs` records only

Each dispatched worker still receives exactly one condition. For DAG execution,
the primary separately dispatches each currently-ready task as its own native Task
using the mode-to-worker mapping above; see `guarana:build` for readiness, worktree,
integration, retry, restart, and cancellation gates. `worker-research` may inspect
only provided pointers using `read`, `grep`, and `glob`; it must never edit, run
bash/shell commands, launch nested tasks, or call `workflow_tick`.

The primary context passes the dispatch contract, waits for the Task return, and
advances workflow state. If Task is unavailable or denied, report the blocker
instead of doing the worker's procedure in the primary context.

Before a worker-code dispatch, confirm the requirements discovery gate above is
closed and the primary has decided the acceptance condition. Have `worker-specs`
record it when a durable human-readable update is needed.

## 4. Stop
After a `worker-specs` dispatch, wait for its changed-path/validation summary. Do
not create a dispatch or validator run when no human-readable record changed.
Before leaving planning, confirm any required acceptance/tracker/project-state
write was reported; do not demand task-specific records for read-only work.
