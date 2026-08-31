# Change: memory Slice 4 — automatic graph compaction

**Date:** 2026-08-30
**Feature:** [memory](../features/memory/memory.md) · Slice 4 of 4
**Stop reason:** condition-met (worker-verify PASS, first gate)

## What shipped
- `memory/compact.js` — `compactVault(vaultDir, { threshold })`: collapses oldest eligible `atom` nodes into a `supernode` (status confirmed) whose `summary` preserves verbatim decision text and lessons; `collapsedIds` provenance; removed atoms + touching edges (no dangling refs). Never compacts decisions/bugs/solutions/refactors/supernodes. Deterministic oldest-atoms selection → idempotent.
- Auto-trigger: post-capture in `plugin/guarana-memory.js` when node count exceeds `compactionThreshold` (already wired in Slice 2's plugin; `memory-compacted` / `memory-error` telemetry, never throws).
- CLI: `guarana memory compact [--threshold N]`; help distinguishes `compact` (atoms→supernode, lessons preserved) vs `prune` (draft trimming).
- Spec: `.specs/features/memory/memory.md` amended — `collapsedIds` provenance supersedes `summarizes` edges.

## Proofs
- `npm test` 78/78 PASS; `npm run check-cli` PASS.
- Worker-verify PASS (single gate, adversarial driver): 20-node graph → 10 oldest atoms collapsed, decisions/bugs/refactor intact, verbatim decision text in summary, zero dangling edges, remaining ≤ threshold; idempotent (byte-identical across repeats); below-threshold/empty/threshold-0-or-negative no-throw no-ops; auto-trigger respects threshold with `memory-compacted` events; readonly vault → `memory-error`, no throw.
- Note: a transient subagent quota failure interrupted the first dispatch; re-dispatched cleanly.

## Full feature now VALIDATED (4/4 slices)
Pending: human final gate (end-to-end resume scenario, per spec) + commit.