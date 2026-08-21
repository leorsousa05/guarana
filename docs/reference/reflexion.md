# Reflexion — Verbal Feedback as Memory

Source: Shinn et al. (2023), arXiv:2303.11366.

## The pattern
After a failure, the agent produces a verbal self-critique and stores it in episodic memory; subsequent attempts read that memory. The learning signal is text, not weights.

## Why guarana cares
- Reflection only works if the reflection SURVIVES — which is why guarana:remember writes to disk (ADR-004), not to context.
- A FAIL verdict from guarana:verify is the reflexion signal: it must say WHICH criterion failed and WHY, or the next attempt has nothing to learn from.
- Reflexion without a cap is unbounded retry (see failure-modes.md). Every reflect-and-retry cycle consumes budget from the same per-run cap.
