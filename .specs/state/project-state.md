# Project State

Last updated: 2026-10-03 (explicit .specs lifecycle writes)

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

## Current step
**Explicit .specs lifecycle writes (2026-10-03) — VALIDATED.** The `guarana:plan` skill now requires concrete task-specific specs before `plan_complete`, synchronized project-state and feature status at each transition, and exact validation proof at completion. The always-on prompt separately states that workflow JSON is not the human-readable record. Updated source and CLI skill bundles; installed the source skill at `~/.agents/skills/guarana/skills/plan/SKILL.md`. Verification: full `npm test` 189/189 and `node scripts/check-cli-bundle.mjs` passed.

**Pending:** Provider-backed fresh OpenCode session smoke against the actual 1.0.0 release candidate; record exact host version before publishing.

## Checkpoint
- Goal: Ensure `.specs` human-readable records are explicitly written throughout Guarana's plan/build/code/verify lifecycle, and install the updated plan skill.
- Acceptance: planning requires task-specific acceptance criteria before plan completion and exact proof/status updates after verification; the always-on prompt distinguishes workflow JSON from `.specs`; source/CLI/global skill copies match; full tests and bundle check pass.
- Pending writes: none.
- Budget: ADR-005 defaults.

## Proofs that exist
Task-1 proofs for all 7 skills in `.specs/features/guarana/proofs/`; all acceptance criteria mapped; worker-verify PASS on every skill. CLI acceptance: 6/6 checks PASS (recorded in changes/2026-08-21-cli.md). Release readiness evidence is in `changes/2026-10-02-release-readiness.md`. Spec lifecycle write proof: `changes/2026-10-03-spec-lifecycle-writes.md`.

## BLOCKED
Nothing. Budget numbers remain ADR-005 defaults pending human override (deferred Rule-0 item, recorded).
