---
name: guarana:remember
description: Use for state, memory, session resume ("where were we"), persistence, or context loss. Disk-only memory with a fixed restore order, mandatory write triggers, and silent-truncation recovery.
---

# guarana:remember

Memory is on disk, not in context (hard truth 3, ADR-004). **Anything that exists only in a context window is treated as nonexistent.**

## Restore sequence (cold start, every run — no other order)
1. `.specs/README.md`
2. `.specs/state/project-state.md`
3. `.specs/decisions/ADR-*.md`
4. The current feature spec in `.specs/features/` (one directory per feature)

## Write triggers (all four are MUST-write)
1. **End of task** → update `state/project-state.md` (never mid-task).
2. **Every stop** → log the stop reason (with guarana:build's Record).
3. **Every decision** → append an ADR; ADRs are append-only.
4. **Every discovered failure** → append to `state/known-issues.md` immediately: title, symptom, reproduction trigger, mitigation, status.

## Silent context truncation
Contexts truncate without warning. Defense:
- **Checkpoint:** at each stage boundary, append open facts (current goal as `- Goal: <goal>` or `- Goal: none`, condition, budget remaining, pending writes) to a checkpoint block in `state/project-state.md`.
- **Detect:** on restore, compare expected checkpoint (from your run position) with what's on disk.
- **Recover:** on mismatch or gap, re-read from disk. NEVER reconstruct missing facts from memory.

## Conflict rule
Disk vs. context conflict → disk wins, always.
