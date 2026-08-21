# Proofs — guarana:build

Append-only. Proofs written BEFORE commit slices; committed proofs never altered.

## Task 1 — Draft build/SKILL.md (2026-08-21)
- **AC1 (four stages in order):** body states "Four stages, always in order: Frame → Run → Verify → Record" plus "Record is NEVER skipped — not on abort, not on error, not on cap". PASS.
- **AC2 (trigger taxonomy):** section 0 defines heartbeat (each turn), cron/budget (schedule or threshold), goal-driven (until verifiable condition) with distinct start conditions. PASS.
- **AC3 (stop reasons enumerated + mandated):** Record section lists exactly condition-met, hard-cap, budget-exhausted, error, human-abort; `grep -o` for the five tokens returns all five; mandate stated ("A run without a logged stop reason is a process violation"). PASS.
- worker-verify verdict: PASS.
