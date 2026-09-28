# Project State

Last updated: 2026-09-28 (global memories included in graph)

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
**Project/global memory graph (2026-09-28) — VALIDATED.** Confirmed nodes from both project and private global vaults now appear in the graph with scope labels and scoped edges; summary counts are split by scope. Intent-driven capture, session deduplication, injection history, and the specs validator are included in this batch. Verification: `npm test` 181/181, production build, `check-cli`, and `specs:validate` pass; global/project plugins are current.

**Pending:** none; requested commit is being completed.

## Checkpoint
- Goal: Display confirmed project and global memories together without mixing scopes or edges.
- Pending writes: none.
- Budget: ADR-005 defaults.

## Proofs that exist
Task-1 proofs for all 7 skills in `.specs/features/guarana/proofs/`; all acceptance criteria mapped; worker-verify PASS on every skill. CLI acceptance: 6/6 checks PASS (recorded in changes/2026-08-21-cli.md).

## BLOCKED
Nothing. Budget numbers remain ADR-005 defaults pending human override (deferred Rule-0 item, recorded).
