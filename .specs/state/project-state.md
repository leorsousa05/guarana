# Project State

Last updated: 2026-09-09 (automatic workflow/spec/memory bootstrap)

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
**Automatic workflow/spec/memory bootstrap (2026-09-09).** Natural tasks now activate the installed orchestrator without a separate plugin command, preserve the task goal, create missing `.specs` records and feature specs, initialize the project memory vault, inject bounded confirmed context, and record verified completions. Active skill injection refreshes after `workflow_tick`; installed global plugin smoke test passed. Details in `.specs/changes/2026-09-09-automatic-workflow.md`. `npm test` 166/166, `check-cli` PASS. Version 0.7.0.

**Pending:** commit this validated batch (ADR-007); then optionally push `main` (ahead of origin).

## Checkpoint
- Goal: none (batch closed). Commit the orchestrator batch + push `main` if desired.
- Pending writes: none (change ledger + state updated).
- Budget: ADR-005 defaults.

## Proofs that exist
Task-1 proofs for all 7 skills in `.specs/features/guarana/proofs/`; all acceptance criteria mapped; worker-verify PASS on every skill. CLI acceptance: 6/6 checks PASS (recorded in changes/2026-08-21-cli.md).

## BLOCKED
Nothing. Budget numbers remain ADR-005 defaults pending human override (deferred Rule-0 item, recorded).
