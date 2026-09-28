# ADR-014 — Intent-driven project and global memory capture

**Status:** Accepted (2026-09-28) · append-only

## Context
Explicit memory tools had no instruction telling the assistant when to use
them, and the private user vault was not initialized or retrieved by the
orchestrator. As a result, durable user preferences and project decisions were
not noticed or saved.

## Decision
The OpenCode memory plugin injects a compact capture policy. The model identifies
durable intent in human messages and calls `memory_save_node` automatically:
standing assistant-behavior preferences are `preference` nodes in the global
user vault; project decisions/bugs/solutions/refactors go to the project vault.
Ordinary task text and raw tool activity are not captured. Existing preferences
are searched before writing; changed preferences supersede old ones.

Global standing preferences are injected at session start and after context
compaction; project context remains task-relevant. Memory writes still pass
through the existing type, relation, and secret validation path. No event hook
stores raw user messages.

## Consequences
The agent recognizes when to save memory without a special user command, while
the two storage scopes remain private and independently searchable.
