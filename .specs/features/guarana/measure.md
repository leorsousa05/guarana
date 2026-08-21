# Feature / guarana:measure

## Summary
Hard truth 4 says stop reasons must be logged, but nothing aggregates them. `guarana:measure` (OPTIONAL, trigger-only) is the telemetry skill: stop-reason logs, token & wall-clock budgets, and health metrics.

## Reference links
- Consumes: run Records from [build.md](build.md); stop reasons enforced by [verify.md](verify.md).
- Knowledge: [docs/reference/outer-loop-triggers.md](../../../docs/reference/outer-loop-triggers.md), [docs/reference/failure-modes.md](../../../docs/reference/failure-modes.md)

## What it is / what it fills
**Problem:** without telemetry, budget overruns and pathological stop-reason distributions (e.g., 80% hard-cap) are invisible until cost or failure forces attention.
**In scope:** the run-log record format (stop reason, tokens, wall-clock, trigger type); aggregation into health metrics (stop-reason distribution, budget utilization); read procedures for tuning.
**Out of scope:** firing by default — loaded ONLY when tuning cost or reading telemetry; alerting infrastructure; dashboards (markdown tables suffice).

## Acceptance criteria
1. **Run-log schema defined.** The body fixes the per-run record fields: run id, trigger type, stop reason (from build's enumeration), tokens, wall-clock, verdict. Proof: body inspection finds all six fields. Demo I/O: a sample run produces a record with all six populated.
2. **Health metrics defined computably.** The body defines at least: stop-reason distribution (percentage per reason) and budget utilization (tokens used / cap per run), each with an exact computation from the log. Proof: body inspection finds both formulas. Demo I/O: given a 4-run sample log, the stated percentages match hand computation.
3. **Trigger-only loading stated.** Frontmatter and body state the skill loads ONLY for cost tuning or telemetry reading. Proof: inspection of both. Demo I/O: a normal build run never routes here.

## Demo criteria
Runbook: write a 4-run sample log per the schema, compute both metrics by hand, compare to the skill's output; accept on exact match.

## SKILL.md overview
Frontmatter: `name: guarana:measure`; description triggering ONLY on telemetry, cost tuning, token budget analysis, stop-reason stats, run health. Body: log schema → where logs live (`.specs/changes/` run-log block or `state/` telemetry file per ADR-004 conventions) → metric computations → interpretation thresholds (e.g., hard-cap share > 25% → route to `guarana:debug`).

## Edge cases & constraints
- Empty log → report "no data"; never fabricate metrics.
- Budget: ≤ 2k tokens loaded; aggregation runs read-only against logs.

## References
- External: Yao et al., ReAct (arXiv:2210.03629) — run trajectories as the unit of measurement.
- Internal: `guarana:build`, `guarana:verify`, `guarana:debug` (threshold escalation target).

## Definition of done
All three acceptance criteria proven in proofs/measure-proofs.md, worker-verify PASS, change recorded.
