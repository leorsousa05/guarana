# Change: memory Slice 3 — custom tools + review workflow

**Date:** 2026-08-30
**Feature:** [memory](../features/memory/memory.md) · Slice 3 of 4
**Stop reason:** condition-met (worker-verify PASS, first gate)

## What shipped
- `memory/tools.js` — the 4 tool handlers (single source of truth, ADR-008): `memorySearch` (confirmed-only via engine), `memorySaveDecision` (confirmed `decision` node, `rejectedAlternatives`, author default `"agent"`), `memoryGetContextForTask` (semantic seed + 1-hop graph expansion over `caused-by`/`depends-on`/`supersedes`, grouped `{ decisions, bugs, superseded, atoms }`, capped), `memoryReviewDraft` (confirm with re-validated edits / discard node+edges). All stored free text passes through security sanitize/reject.
- Plugin wiring: `plugin/guarana-memory.js` exposes the 4 tools via a `tool` map (`{ description, args, execute }`, JSON-string results, never throws). Isolated marked section — the exact OpenCode custom-tool shape is a ~10-line fix if the upstream API differs.
- `memory/graph.js`: optional `rejectedAlternatives` field validation (backward compatible) + `removeNode` (drops node + touching edges).
- CLI: `guarana memory review --list | <id> --confirm [--intent/--tags edits] | <id> --discard`; clean exit-1 errors; help updated.

## Proofs
- `npm test` 70/70 PASS; `npm run check-cli` PASS.
- Worker-verify PASS (single gate): criteria 11–13 + CLI review independently reproduced; edge probes clean (empty search, limit 1/100, discard-then-review, bad action, secret in decision text hard-rejected, drafts with edges never surface, no auto-injection, boundary never throws).

## Not shipped (next slice)
- Slice 4: automatic graph compaction (supernodes, threshold config, provenance edges, prune integration).

## Known caveat
- Custom-tool registration shape is medium-high confidence against OpenCode's plugin API (normally `tool()` from `@opencode-ai/plugin`, unavailable under zero-deps). If OpenCode's exact API differs, only the isolated tools section of the plugin needs adjustment.
