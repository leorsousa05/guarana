# Planning Audit — guarana:debug

Run: 2026-08-21 (pre-implementation, before building debug)

## Task list
1. Draft skills/guarana/skills/debug/SKILL.md per spec sections 7 (SKILL.md overview).
2. Self-check against the 3 acceptance criteria in features/guarana/debug.md.
3. Append proofs to proofs/debug-proofs.md BEFORE commit slice.
4. Dispatch worker-verify (fresh context) for the gate.

## Dependency coverage
Spec section "Reference links" lists all siblings this skill depends on; confirmed present or build-order-respecting (see overview.md).

## Acceptance coverage
3/3 acceptance criteria are falsifiable, each naming a runnable proof and demo I/O. No vague words ("support", "handle", "easier", "improve") present — checked.

## Token budget
Per ADR-005 defaults; stated in spec section "Edge cases & constraints".

## Gate
No material ambiguity blocks CLARITY. PASS — implementation may proceed.
