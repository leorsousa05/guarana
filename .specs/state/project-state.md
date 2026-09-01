# Project State

Last updated: 2026-08-31 (dashboard & CLI enhancements — plugin status, resume card, health gauges, decision lineage)

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

## Current step
**Dashboard & CLI enhancements (2026-08-31).** Added `guarana plugin status` (install/engine/vault health, stale + foreign detection); dashboard resume card (open goal + copyable resume prompt wired to memory_get_context_for_task); data-backed health gauges (error rate, tokens vs ADR-005 ref, runs); memory-graph decision lineage (supersedes diff). `buildLineage` extracted to a pure module + 5 tests. Details in `.specs/changes/2026-08-31-dashboard-cli-enhancements.md`. `npm test` 120/120, `check-cli` PASS, frontend rebuilt, engine/plugins redeployed. Version 0.6.3.

**Pending:** commit (ADR-007); then optionally push `main` (ahead of origin).

## Checkpoint
- Goal: none (batch closed). Commit the dashboard/CLI enhancement batch + push `main` if desired.
- Pending writes: none (change ledger + state updated).
- Budget: ADR-005 defaults.

## Proofs that exist
Task-1 proofs for all 7 skills in `.specs/features/guarana/proofs/`; all acceptance criteria mapped; worker-verify PASS on every skill. CLI acceptance: 6/6 checks PASS (recorded in changes/2026-08-21-cli.md).

## BLOCKED
Nothing. Budget numbers remain ADR-005 defaults pending human override (deferred Rule-0 item, recorded).
