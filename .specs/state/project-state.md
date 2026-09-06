# Project State

Last updated: 2026-08-31 (automatic orchestrator — always-on engineering loop)

## Per-skill status
| Skill | Status |
|---|---|
| guarana:plan | SHIPPED |
| guarana:build | SHIPPED |
| guarana:code | SHIPPED |
| guarana:verify | SHIPPED |
| guarana:remember | SHIPPED |
| guarana:debug | SHIPPED (optional, trigger-only) |
| guarana:measure | SHIPPED (optional, trigger-only) |
| guarana CLI | SHIPPED |
| guarana dashboard | VALIDATED |
| guarana memory | **FINAL GATE PASSED** + hardening batch applied |
| guarana orchestrator | **SPECIFIED → IMPLEMENTED → VALIDATED** |

## Current step
**Automatic orchestrator (2026-08-31).** Added an always-on orchestration layer that turns the manual skill workflow into an automatic loop. Host-independent core `orchestrator/` (state machine `idle/planning/building/coding/verifying/debugging/completed`, intent→skill decision, progressive-disclosure prompt builders) + thin opencode plugin `plugin/guarana-orchestrator.js` (chat.message, system.transform, tool.execute.after, workflow_get/workflow_tick tools). State persists to `.specs/state/workflow.json` (disk is source of truth; resumed across turns). Verify-fail auto-routes to debugging→fix→re-verify; explicit `guarana:*` still forces a step. Dashboard Workflow panel + `/api/workflow/current`. Details in `.specs/changes/2026-08-31-orchestrator.md`. `npm test` 156/156, `check-cli` PASS, frontend rebuilt, orchestrator plugin+engine redeployed. Version 0.6.4.

**Pending:** commit (ADR-007); then optionally push `main` (ahead of origin).

## Checkpoint
- Goal: none (batch closed). Commit the orchestrator batch + push `main` if desired.
- Pending writes: none (change ledger + state updated).
- Budget: ADR-005 defaults.

## Proofs that exist
Task-1 proofs for all 7 skills in `.specs/features/guarana/proofs/`; all acceptance criteria mapped; worker-verify PASS on every skill. CLI acceptance: 6/6 checks PASS (recorded in changes/2026-08-21-cli.md).

## BLOCKED
Nothing. Budget numbers remain ADR-005 defaults pending human override (deferred Rule-0 item, recorded).
