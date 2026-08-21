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

## Build order (hard rule)
plan → build → code → verify → remember → debug → measure. Never start N+1 before N validates and ships.

## Progressive-disclosure rule (one line)
The main thread always holds only the suite index plus `guarana:plan`; every other body loads into context only when its trigger fires.
