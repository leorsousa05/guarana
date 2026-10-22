# Guarana Suite — Overview

## What the suite does
Guarana installs AI Loop Engineering into OpenCode: a disciplined inner loop (Perceive → Think → Act → Observe) supervised by an outer loop that decides when to run, what state persists, how results are verified, and when to stop. Stopping is mechanical, verification is independent, and memory is on disk.

## The seven skills (fixed, never renamed)
| Skill | Kind | One-liner |
|---|---|---|
| [guarana:plan](guarana/plan.md) | core | Meta-skill: restores state, routes intent to exactly one skill, dispatches with condition + budget. |
| [guarana:build](guarana/build.md) | core | The run lifecycle: Frame → Run → Verify → Record; triggers; budgets; stop reasons. |
| [guarana:code](guarana/code.md) | core | Implementation: read-before-edit, minimal diffs, diff + stop-reason return contract. |
| [guarana:verify](guarana/verify.md) | core | Termination: 3 guards, validation gate, structural verification split. |
| [guarana:remember](guarana/remember.md) | core | Disk-only memory: restore order, write triggers, silent-truncation recovery. |
| [guarana:debug](guarana/debug.md) | optional | Failure-mode matrix + defusals; fires ONLY on failure/misbehavior. |
| [guarana:measure](guarana/measure.md) | optional | Telemetry: stop-reason logs, budgets, health metrics; fires ONLY for cost tuning/telemetry. |

## Orchestrator (always-on layer)
The [orchestrator](orchestrator/orchestrator.md) sits above the skills and makes the loop automatic: an always-on state machine (`idle → planning → building → coding → verifying → debugging → completed`), persisted to `.specs/state/workflow.json`, selects which skill to load each turn, bootstraps missing specs, and supplies relevant confirmed memory. It decides *what*; the skills still do *how*. Explicit `guarana:*` commands remain an escape hatch that force a step. `guarana:plan` is now an internal workflow step, not a required manual entry point.

The validated [specs record command](orchestrator/spec-record-command.md) has a VALIDATED follow-up for [safe exact-name tracker-row removal](orchestrator/spec-record-tracker-removal.md), independently verified PASS and recorded VALIDATED in its feature spec and tracker, as described in [ADR-034](../decisions/ADR-034-safe-tracker-row-removal.md). The separate [known-issue status update](orchestrator/spec-record-known-issue-status.md) follow-up is VALIDATED under [ADR-035](../decisions/ADR-035-versioned-known-issue-status-updates.md), independently verified PASS (9/9), and recorded in [the 2026-10-20 change record](../changes/2026-10-20-spec-record-known-issue-status.md). The real known-issues file was unchanged; no commit, push, release, or shipping occurred.

## Release assurance
The [release-readiness feature](release/release-readiness.md) defines the supported Node/OpenCode contract, reproducible npm packaging, and automated CI matrix. [Smoke-test retirement](release/smoke-test-retirement.md) states that package/release/OpenCode-host smoke tests MUST NOT be run or reintroduced; `npm pack --dry-run --json` remains package-content inspection only.

## Build order (hard rule)
plan → build → code → verify → remember → debug → measure. Never start N+1 before N validates and ships. (The orchestrator layers on top of all shipped skills.)

## Progressive-disclosure rule (one line)
The main thread always holds only the suite index plus the active skill and bounded relevant memory; non-active skill bodies stay out of context. The orchestrator injects the **active** skill's full body each turn (ponytail-style).
