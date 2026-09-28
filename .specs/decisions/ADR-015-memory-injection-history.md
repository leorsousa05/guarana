# ADR-015 — Record memory injection references for local inspection

**Status:** Accepted (2026-09-28) · append-only

## Context
The memory graph records what can be retrieved, but users cannot tell which
nodes were actually placed in an assistant turn's system context.

## Decision
At system-context injection, append a `memory-injected` telemetry event with
timestamp, session, workflow state, and only `{ id, type, scope }` references.
The local dashboard hydrates the displayed text from the project and private
user vaults. Do not duplicate global preference text into project telemetry.

## Consequences
The dashboard can show accurate recent injection history while the telemetry
log remains small and the user vault stays the source of truth for memory text.
Injection references are emitted once per session for new nodes, then again
after compaction or when previously unseen memory becomes relevant. Duplicate
system transforms and duplicate global/project plugin instances do not re-emit
the same node set.
