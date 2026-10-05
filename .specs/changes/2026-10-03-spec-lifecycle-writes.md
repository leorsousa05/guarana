# Explicit `.specs` lifecycle writes

**Status:** VALIDATED  
**Date:** 2026-10-03

## Goal
Prevent the automatic workflow from advancing while its human-readable `.specs` records remain generic or stale.

## Changes
- `guarana:plan` now makes `.specs` writes mandatory: planning replaces bootstrap placeholders with task-specific goal, requirements, assumptions/open questions, boundaries, and falsifiable acceptance criteria; tracker and project-state are synchronized before `plan_complete`.
- The plan contract requires project-state and feature status updates at lifecycle transitions, and exact proof/status updates after independent verification. It explicitly distinguishes workflow JSON from the human-readable record and requires confirming edits landed.
- The always-on orchestrator prompt repeats the record-keeping invariant so it remains active outside the plan skill body.
- Synced the canonical skill and orchestrator prompt to the CLI distribution and installed the canonical plan skill at `~/.agents/skills/guarana/skills/plan/SKILL.md`.

## Verification
- `npm test` — PASS, 189/189.
- `node scripts/check-cli-bundle.mjs` — PASS, CLI bundle synchronized.
- Installed global `SKILL.md` compared byte-for-byte with canonical source — PASS.

## Known limitation
These are explicit agent instructions, not an automatic filesystem transaction: the model must still perform the documented edits. Completion now requires inspecting those edits instead of treating `workflow_tick` as proof.
