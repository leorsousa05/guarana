# Project State

Last updated: 2026-10-07 (1.0.0 candidate revalidation after fresh-project bootstrap finding)

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
| Guarana native worker dispatch | **VALIDATED** |
| Guarana release readiness | **VALIDATED** |
| Guarana 1.0.0 candidate preparation | **VALIDATED** |
| Guarana automatic skill creation | **VALIDATED** |
| Guarana skill routing clarity | **VALIDATED** |

## Current step
**1.0.0 candidate preparation (2026-10-07) — VALIDATED.** The initial final-candidate smoke exposed a missing `## Master tracker` heading in fresh-project bootstrap; the fix and shipped-validator regression test are included. The post-fix full release gate, final 1.0.0 archive, provider-backed smoke, plugin/status/dashboard checks, and uninstall all passed. Independent worker-verify `ses_ee737f1aaffeL1oEwBUZ1AeEs8` passed all five release criteria. Candidate remains local, unpublished, and untagged.

**Pending:** Maintainer decision to publish/tag; no publish or tag has occurred.

## Checkpoint
- Goal: Prepare the Guarana 1.0.0 release candidate and verify the packed artifact and fresh OpenCode integration.
- Acceptance: package version, README version/status, and changelog agree on 1.0.0; every command in `RELEASING.md` passes; the packed 1.0.0 tarball installs and passes fresh-session plugin/skill/Task workflow smoke on the recorded current stable OpenCode; exact evidence is recorded; no publish/tag occurs.
- Latest packed candidate before fix: `8e994a275319fe58e7861ea33a5e3154a2f53215`, 181859 bytes, 88 files, zero `node_modules` paths. This artifact predates the bootstrap fix and must be replaced.
- Final post-fix proof is recorded in `.specs/features/release/release-candidate-1.0.0-smoke.jsonl` and `.specs/changes/2026-10-07-release-candidate-1.0.0.md`.
- Independent final verification: worker-verify PASS (5/5), session `ses_ee737f1aaffeL1oEwBUZ1AeEs8`; verifier reran the automated gate and checked final archive inventory, smoke, and records.
- Pending writes: none for candidate preparation.
- Budget: ADR-005 defaults.

## Proofs that exist
Task-1 proofs for all 7 skills in `.specs/features/guarana/proofs/`; all acceptance criteria mapped; worker-verify PASS on every skill. CLI acceptance: 6/6 checks PASS (recorded in changes/2026-08-21-cli.md). Release readiness evidence is in `changes/2026-10-02-release-readiness.md`; 1.0.0 candidate evidence and revalidation follow-up are in `changes/2026-10-07-release-candidate-1.0.0.md` and `features/release/release-candidate-1.0.0-smoke.jsonl`. Spec lifecycle write proof: `changes/2026-10-03-spec-lifecycle-writes.md`. Automatic skill-creation proof: `changes/2026-10-05-automatic-skill-creation.md`, `changes/2026-10-05-skill-trigger-guidance.md`, and validated routing clarity in `changes/2026-10-07-skill-routing-clarity.md`. Native Task worker dispatch proof is in `changes/2026-10-07-native-task-worker-dispatch.md` and `features/orchestrator/subagent-dispatch-smoke.jsonl`. Dashboard skill-scope count proof: `changes/2026-10-05-dashboard-skill-scope-counts.md`.

## BLOCKED
Final 1.0.0 candidate is validated; publishing/tagging remains a separate maintainer action. Budget numbers remain ADR-005 defaults pending human override (deferred Rule-0 item, recorded).
