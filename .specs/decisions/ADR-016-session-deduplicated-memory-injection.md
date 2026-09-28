# ADR-016 — Deduplicate memory injection within a session

**Status:** Accepted (2026-09-28) · append-only

## Context
OpenCode rebuilds system context for multiple model generations in one
conversation, and the orchestrator plugin may be loaded from both project and
global scopes. Injecting the same memory set on every transform caused repeated
tokens and duplicate history entries before context compaction.

## Decision
Track injected node IDs per project/session. Inject only unseen nodes; reset the
cache on session creation and `session.compacted`, when the retained context may
have changed. Share the cache across global/project plugin instances and add a
marker for a shared system transform. Log only newly injected node references,
and collapse consecutive duplicate legacy telemetry until a compaction boundary
in dashboard history.

## Consequences
Newly relevant memories can enter an active session once; unchanged memories are
not repeated until compaction or a new session, when current context is injected
again.
