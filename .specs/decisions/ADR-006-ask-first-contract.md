# ADR-006 — The ASK-first contract (Rule 0)

**Status:** Accepted (2026-08-21) · append-only

## Context
Building on guessed answers produces specs that must be rewritten. The human is the only source of several contract facts.

## Decision
Rule 0: before ANY work, collect — repo layout & language, runtime/env, coding conventions, key dependencies, existing skills/tooling, where `.specs/` resides, who the verifier is, token/cost budget, and the acceptance gate the human runs for "done". Missing or rejected answers are recorded ADR-form; work does not start until the record exists. During the build, if a decision needs the human, the agent asks — it does not guess.

## Rule-0 answers (2026-08-21)
- Repo: markdown-only; the suite is consumed by OpenCode itself. Every SKILL.md written to OpenCode's skill schema.
- Runtime/env: OpenCode on this machine.
- Verifier: layered — worker-verify is the technical gate; the human is the final "done" gate.
- Budgets: three separate budgets per spec (per-run cap, per-subagent cap, main-thread). Exact numbers deferred to ADR-005 defaults pending human override.
- Deferred-answer policy: record deferrals, keep building.
- `.specs/` resides at the project root `/home/arch/codes/Guarana/.specs/`.

## Tradeoffs
- One round of questions up front vs. many rewrites later. Chosen: ask first.
