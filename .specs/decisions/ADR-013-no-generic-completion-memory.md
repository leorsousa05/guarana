# ADR-013 — Workflow completion is telemetry, not memory

**Status:** Accepted (2026-09-27) · append-only

## Context
The orchestrator saved a confirmed `decision` after every successful workflow.
Those entries only stated that a task completed, had no reusable knowledge, and
were disconnected from the graph.

## Decision
Do not persist generic workflow completion markers in the memory graph.
Completion remains in workflow state and telemetry. Persist memory only when a
specific durable decision, bug, solution, or refactor is intentionally recorded.

## Supersedes
ADR-011 item 3's automatic completion decision and its completion-memory
tradeoff. Automatic vault initialization and bounded memory retrieval remain.
