# Project State

Last updated: 2026-10-05 (dashboard skill-scope counts)

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
| Guarana release readiness | **VALIDATED** |
| Guarana automatic skill creation | **VALIDATED** |

## Current step
**Dashboard skill-scope counts (2026-10-05) — VALIDATED.** Independent verification passed all six criteria. Global and Project counts reflect successful API arrays (including zero), loading/errors show no false counts, tabs preserve keyboard semantics, 375px layout remains usable, the project process skill has valid content, and tests/build/bundle/spec validation pass.

**Pending:** Provider-backed fresh OpenCode session smoke against the actual 1.0.0 release candidate; record exact host version before publishing.

## Checkpoint
- Goal: Make generated-skill counts visible in each Skills scope tab and preserve a reusable dashboard-change process.
- Acceptance: Global and Project tabs display counts derived from the corresponding `/api/skills` arrays; the existing tab semantics and keyboard controls remain intact; mobile-width layout remains usable; generated skill `dashboard-change-process` documents the inspection, ledger/accessibility/responsive, bundle, test, and validator workflow; build, test, bundle, and specs checks pass.
- Pending writes: none.
- Budget: ADR-005 defaults.

## Proofs that exist
Task-1 proofs for all 7 skills in `.specs/features/guarana/proofs/`; all acceptance criteria mapped; worker-verify PASS on every skill. CLI acceptance: 6/6 checks PASS (recorded in changes/2026-08-21-cli.md). Release readiness evidence is in `changes/2026-10-02-release-readiness.md`. Spec lifecycle write proof: `changes/2026-10-03-spec-lifecycle-writes.md`. Automatic skill-creation proof: `changes/2026-10-05-automatic-skill-creation.md`. Dashboard skill-scope count proof: `changes/2026-10-05-dashboard-skill-scope-counts.md`.

## BLOCKED
Nothing. Budget numbers remain ADR-005 defaults pending human override (deferred Rule-0 item, recorded).
