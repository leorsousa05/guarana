# Outer-Loop Triggers and Stopping

## The outer loop
Wraps a whole run as one step: decides **when to run, what state to keep, how to verify, when to stop**. The inner loop (ReAct) does the work; the outer loop owns the budget and the verdict.

## Trigger types
- **Heartbeat** — run on each turn. Use for incremental progress on a standing goal.
- **Cron / budget** — run on schedule or when a budget threshold is crossed. Use for maintenance and telemetry.
- **Goal-driven** — run until a verifiable condition holds. The default for feature work.

## Stopping (hard truth 1)
Stopping is checked by machinery, never by iterators. The only legitimate stops:
1. Verifiable condition met (confirmed by the independent verifier).
2. Hard cap hit (tokens / iterations / wall-clock).
3. Budget exhausted.
4. Error (with stop reason logged).
5. Human abort.

"Looks complete" is never a stop condition. And hard truth 5: if a result can't fail the gate, the loop can't tell success from failure — the condition must be fixed before the run starts.

## Stop reason
Every run logs exactly one stop reason. Without it, health can't be diagnosed (hard truth 4) and guarana:measure has nothing to aggregate.
