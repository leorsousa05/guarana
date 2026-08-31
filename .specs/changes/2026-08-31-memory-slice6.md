# Change: memory Slice 6 — workflow integration (teach the skills when to use memory)

**Date:** 2026-08-31
**Feature:** [memory](../features/memory/memory.md) · Slice 6 of 6
**Stop reason:** condition-met (worker-verify PASS, first gate)

## What shipped
- **`skills/guarana/skills/plan/SKILL.md`** — new Memory block: consider `memory_get_context_for_task` on interrupted/resume work; consider `memory_save_decision` on run close. Explicit, judgment-based; never auto-injection. Routing table gained a row → `guarana:memory`.
- **`skills/guarana/skills/remember/SKILL.md`** — memory vault documented as a pull-only resume layer (query `memory_get_context_for_task` on context loss), complementing the `.specs/` disk restore.
- **`skills/guarana/skills/memory/SKILL.md`** (NEW) — dedicated `guarana:memory` skill: the 4 tools, draft→confirmed lifecycle (auto-captured atoms are drafts until reviewed; only confirmed are retrieved), pull-only hard rule.
- **`skills/guarana/SKILL.md`** — suite index row for `guarana:memory`.
- Synced to `cli/skills/guarana/` (byte-identical).

## Proofs
- `npm run check-cli` PASS (skills bundled).
- Worker-verify PASS (single gate): criterion 19/20/21 — non-injection preserved (no "inject"/"always load"), tool names match ADR-008 exactly, generic-only bodies (no project-specific facts/decision texts/node ids), routing + index + new skill all present in source AND bundle (byte-identical).

## Impact
The memory system is now discoverable by the agent: `guarana:plan` (runs on every task) teaches when to query/save; `guarana:remember` treats the vault as a resume layer; the new `guarana:memory` skill holds the reference. Retrieval remains pull-only by design.