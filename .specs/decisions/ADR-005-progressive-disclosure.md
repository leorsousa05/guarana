# ADR-005 — Progressive disclosure and budgets

**Status:** Accepted (2026-08-21) · append-only

## Context
Holding all seven skill bodies in the main thread wastes context; holding none loses capability. Budgets must be explicit per spec (conventions.md).

## Decision
Progressive disclosure: the main thread always holds only the suite index (`skills/guarana/SKILL.md`, a few hundred tokens) plus `guarana:plan`. Full bodies load only when their trigger fires.

### Recorded default budgets (human may override; Rule-0 answer deferred exact numbers to these defaults)
- Main thread: ≤ 8k tokens steady-state (index + plan + active summaries).
- worker-code: 8k tokens per dispatch.
- worker-verify: 4k tokens per dispatch.
- worker-debug: 6k tokens per dispatch.
- Per-run hard cap: 32k tokens / 15 min wall-clock per outer-loop rotation.

## Tradeoffs
- Small main-thread budget forces discipline in worker summaries; risk is lossy summaries — mitigated by the rule that durable facts go to disk (ADR-004), not summaries.
