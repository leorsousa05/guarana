---
name: guarana:measure
description: OPTIONAL — use ONLY when tuning cost or reading telemetry: stop-reason statistics, token and wall-clock budget analysis, run health metrics. Never load during ordinary build runs.
---

# guarana:measure

Trigger-only skill for telemetry and cost tuning.

## Run-log schema (each actual build run, six fields)
`run_id` · `trigger_type` (heartbeat | cron | goal-driven) · `stop_reason` (condition-met | hard-cap | budget-exhausted | error | human-abort) · `tokens` · `wall_clock` · `verdict` (PASS | FAIL | n/a)

Each actual run's six-field log is retained in operational run state by
`guarana:build`'s Record stage; it is not a task-specific feature-spec update.

## Health metrics (exact computations)
- **Stop-reason distribution** = count(reason) / total runs, per reason, over the log window.
- **Budget utilization** = tokens used / per-run cap (default 32k), per run; report mean and max.

## Interpretation thresholds
- `hard-cap` share > 25% → conditions are too weak or budgets too small → route to guarana:debug.
- `error` share > 10% → investigate the run failures. The aggregate rate alone is
  not a known issue; record one only for a confirmed, reproducible product failure
  with a useful durable mitigation, excluding tool/verifier scope and transient
  permission/environment failures.
- Mean utilization > 80% → budget or scope is mis-sized → bring numbers to the human.

## Gotchas
- Empty log → report "no data". Never fabricate metrics.
- Aggregation is read-only against logs. This skill never writes run records — guarana:build does (Record stage).
