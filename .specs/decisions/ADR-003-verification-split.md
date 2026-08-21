# ADR-003 — Verification split is structural

**Status:** Accepted (2026-08-21) · append-only

## Context
An implementer that approves its own work conflates "I wrote it" with "it works". Self-approval is the single most common cause of false-green runs in agent systems.

## Decision
Implementer ≠ verifier, enforced structurally: worker-code and worker-verify are separate subagent contexts with separate budgets (see architecture.md). worker-verify returns pass/fail + proof; the human is the final "done" gate layered on top.

## Failure this prevents
A worker-code agent declaring "done" on a change that does not satisfy the verifiable condition — undetectable without an independent gate, because the same context that produced the bias evaluates the result.

## Tradeoffs
- Extra token cost for a second context.
- Slightly slower ship cycles.
- Accepted: false-green merges cost more than both.
