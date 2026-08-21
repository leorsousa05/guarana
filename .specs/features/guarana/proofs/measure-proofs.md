# Proofs — guarana:measure

Append-only. Proofs written BEFORE commit slices; committed proofs never altered.

## Task 1 — Draft measure/SKILL.md (2026-08-21)
- **AC1 (six-field schema):** run_id, trigger_type, stop_reason, tokens, wall_clock, verdict — all present; `grep -o … | sort -u | wc -l` → 6. PASS.
- **AC2 (computable metrics):** stop-reason distribution = count(reason)/total runs; budget utilization = tokens/per-run cap with mean and max. Hand-check on 4-run sample (1 condition-met, 1 hard-cap, 2 error): distribution 25/25/50%, matches formula. PASS.
- **AC3 (trigger-only):** frontmatter "use ONLY when tuning cost or reading telemetry"; body: "Trigger-only skill"; never writes run records (build's Record does). PASS.
- worker-verify verdict: PASS.
