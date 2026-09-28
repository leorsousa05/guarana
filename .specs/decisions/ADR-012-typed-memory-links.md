# ADR-012 — Typed memory writes with explicit semantic links

**Status:** Accepted (2026-09-27) · append-only

## Context
The memory graph supports decision, bug, solution, and refactor nodes plus
semantic edges, but its only normal write tool always created a `decision` and
could not create edges. This misclassified bug reports and left every saved
record isolated.

## Decision
Add `memory_save_node` for confirmed decision/bug/solution/refactor records and
optional explicit links to existing confirmed nodes. Add `fixes` and
`relates-to` edge types. Preserve `memory_save_decision` as a compatible
decision-only tool. Never invent a link when no meaningful target is known.

## Consequences
Typed records can be connected at creation and related context can retrieve in
one hop. Root memories may remain unlinked until a meaningful relation exists.
