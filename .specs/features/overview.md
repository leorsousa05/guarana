# Guarana Suite — Overview

## What the suite does
Guarana installs AI Loop Engineering into OpenCode: a disciplined inner loop (Perceive → Think → Act → Observe) supervised by an outer loop that decides when to run, what state persists, how results are verified, and when to stop. Stopping is mechanical, verification is independent, and memory is on disk.

## The nine Guarana procedures (fixed, never renamed)
| Skill | Kind | One-liner |
|---|---|---|
| [guarana:plan](guarana/plan.md) | core | Meta-skill: restores state, routes intent to exactly one skill, dispatches with condition + budget. |
| [guarana:build](guarana/build.md) | core | The run lifecycle: Frame → Run → Verify → Record; triggers; budgets; stop reasons. |
| [guarana:code](guarana/code.md) | core | Implementation: read-before-edit, minimal diffs, diff + stop-reason return contract. |
| [guarana:verify](guarana/verify.md) | core | Termination: 3 guards, validation gate, structural verification split. |
| [guarana:remember](guarana/remember.md) | core | Disk-only memory: restore order, write triggers, silent-truncation recovery. |
| [guarana:memory](memory/memory.md) | core | Search, review, and save durable knowledge in project and private global memory graphs. |
| [guarana:debug](guarana/debug.md) | optional | Failure-mode matrix + defusals; fires ONLY on failure/misbehavior. |
| [guarana:measure](guarana/measure.md) | optional | Telemetry: stop-reason logs, budgets, health metrics; fires ONLY for cost tuning/telemetry. |
| [guarana:specs](orchestrator/spec-record-command.md) | core | Dedicated worker-specs procedure for factual, human-readable `.specs` record updates. |

The suite index at `skills/guarana/SKILL.md` is separate from these nine
procedures. The CLI mirror under `cli/skills/guarana` is a distribution copy,
not additional skills; the four project-local `.opencode/skills` developer
playbooks are a separate inventory.

## Orchestrator (always-on layer)
The [orchestrator](orchestrator/orchestrator.md) sits above the skills and makes the loop automatic: an always-on state machine (`idle → planning → building → coding → verifying → debugging → completed`), persisted to `.specs/state/workflow.json`, selects which skill to load each turn, bootstraps missing specs, and supplies relevant confirmed memory. It decides *what*; the skills still do *how*. Explicit `guarana:*` commands remain an escape hatch that force a step. `guarana:plan` is now an internal workflow step, not a required manual entry point.

The validated [specs record command](orchestrator/spec-record-command.md) has a VALIDATED follow-up for [safe exact-name tracker-row removal](orchestrator/spec-record-tracker-removal.md), independently verified PASS and recorded VALIDATED in its feature spec and tracker, as described in [ADR-034](../decisions/ADR-034-safe-tracker-row-removal.md). The separate [known-issue status update](orchestrator/spec-record-known-issue-status.md) follow-up is VALIDATED under [ADR-035](../decisions/ADR-035-versioned-known-issue-status-updates.md), independently verified PASS (9/9), and recorded in [the 2026-10-20 change record](../changes/2026-10-20-spec-record-known-issue-status.md). The real known-issues file was unchanged; no commit, push, release, or shipping occurred.

The TASKED [blocker-recovery and atomic-kickoff feature](orchestrator/blocker-recovery-and-atomic-kickoff.md) records evidence-gap recovery, proportionate verification, and the accepted `workflow_tick(start_task)` contract in [ADR-037](../decisions/ADR-037-atomic-workflow-task-kickoff.md).

The VALIDATED [native `workflow_tick` caller-identity guard](orchestrator/workflow-tick-caller-identity-guard.md) is a bounded follow-up to [native Task worker dispatch](orchestrator/subagent-dispatch.md). It records fail-closed identity checks and explicitly leaves the unexplained external `unknown action: start_task` mismatch outside scope.

The VALIDATED [parallel subtask orchestration feature](orchestrator/parallel-subtask-orchestration.md) provides DAG-based read-only research and isolated code subtasks within one primary workflow; fresh independent `worker-verify` passed all eight criteria. One assigned native Task demonstrated access to its explicit worktree path, not a general host guarantee or OS sandbox. Native cancellation remains unavailable/unverified and request/reconcile-only; `.lock.coord` contention fails closed without automatic recovery. No commit, push, release, tag, or publication occurred. Details: [2026-10-26 change record](../changes/2026-10-26-parallel-subtask-orchestration.md) and [ADR-045](../decisions/ADR-045-safe-parallel-subtask-orchestration.md).

The bounded [intent and provenance safety follow-up](orchestrator/intent-provenance-safety.md) is SHIPPED after independent offline checks, the completed authorized live gate, and normal GitHub push. One live native worker-verify Task preserved project workflow bytes after global plugin deployment and restart confirmation. No npm publication, tag, or version change occurred.

The explicit plugin-ownership adoption decision is recorded in [ADR-039](../decisions/ADR-039-explicit-plugin-ownership-adoption.md); its offline implementation and completed live-gate proof belong to the shipped intent/provenance follow-up above, not to a separate release.

The [global `workflow_tick` runtime deployment](orchestrator/global-workflow-tick-runtime-deployment.md) is SHIPPED as a global plugin/engine deployment and isolated runtime proof; it is not a package release, and no package-version or npm-publication action occurred.

The existing [persistent memory feature](memory/memory.md) remains VALIDATED. Its separate [memory hardening follow-up](memory/memory-hardening.md) is now VALIDATED after fresh independent worker-verify returned overall PASS for all eight acceptance criteria. The accepted capture, confirmed-node erasure, retrieval, and bounded-trust context decisions remain recorded in [ADR-038](../decisions/ADR-038-safe-bounded-memory-context.md); no shipping is claimed.

The [global preference injection budget](memory/global-preference-injection-budget.md) is source-shipped on origin/main; it injects the complete eligible active preference payload losslessly under a configurable effective token ceiling, or fails closed for the whole payload. Its accepted overflow and UTF-8 estimate contract is in [ADR-044](../decisions/ADR-044-configurable-preference-injection-budget.md), with proof in the [2026-10-25 change record](../changes/2026-10-25-global-preference-injection-budget.md). This is not an npm publication or package tag; no actual vault contents were inspected or changed.

The [Dashboard Memory preference graph and one-hop context groups](dashboard/memory-preference-graph-and-context.md) are also present in shipped source on origin/main. Automatic context keeps direct, related, and reached superseded global preferences distinct and traverses exactly one relationship hop; project context is not injected. No package publication or tag is implied.

The VALIDATED [Dashboard Workflow current parallel-subtasks view](dashboard/current-parallel-subtasks.md) adds a read-only projection of the current run from the primary-owned sidecar, without dispatch or historical browsing. Its API and privacy contract is recorded in [ADR-046](../decisions/ADR-046-dashboard-parallel-subtask-projection.md); the root README documentation is complete. Fresh independent `worker-verify` passed all six criteria; see the [2026-10-27 change record](../changes/2026-10-27-dashboard-current-parallel-subtasks.md). This remains uncommitted and not shipped.

The separate TASKED [Dashboard current-parallel-subtasks source-candidate delivery](release/dashboard-parallel-subtasks-source-candidate.md) is authorized for an unpublished, untagged 1.5.2 source candidate and normal push to `origin/main`, subject to its candidate gates. The implementation record above remains VALIDATED; no package publication, tag, formal release, or smoke test is authorized.

## Release assurance
The [release-readiness feature](release/release-readiness.md) defines the supported Node/OpenCode contract, reproducible npm packaging, and automated CI matrix. [Smoke-test retirement](release/smoke-test-retirement.md) states that package/release/OpenCode-host smoke tests MUST NOT be run or reintroduced; `npm pack --dry-run --json` remains package-content inspection only. [Guarana 1.5.0](release/version-bump-1-5-0.md) is SHIPPED as a Stable GitHub tag (`v1.5.0`); no npm publication or formal LTS/maintenance promise is claimed. The remote annotated tag and CI proof are in the current release record; no GitHub Release page was created.

## Build order (hard rule)
plan → build → code → verify → remember → debug → measure. Never start N+1 before N validates and ships. (The orchestrator layers on top of all shipped skills.)

## Progressive-disclosure rule (one line)
The main thread always holds only the suite index plus the active skill and bounded relevant memory; non-active skill bodies stay out of context. The orchestrator injects the **active** skill's full body each turn (ponytail-style).
