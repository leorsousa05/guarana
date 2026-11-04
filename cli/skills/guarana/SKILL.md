---
name: guarana
description: Index for Guarana engineering, automation, research, and memory skills. Route workflow tasks through plan/build/code/verify; use remember for project-state restoration, memory for graph knowledge, skill-authoring for reusable procedures, and memory-maintenance for graph hygiene.
---

# Guarana Suite Index

The automatic orchestrator is always active when Guarana is installed. It routes
workflow requests, does not scaffold human-readable `.specs/` records when a task
starts, and supplies eligible confirmed memory. Create documentation only when
the user asks or discovery establishes a durable need. This index defines trigger boundaries and points to each skill;
the linked skill body owns its procedure. Explicit `guarana:<skill>` commands
remain an escape hatch.

Skills are installed at either `project` or `global` scope. Scope is the install
location and is independent of topical category.

| Skill | Category | Scope | Description | Trigger | Body |
|---|---|---|---|---|---|
| guarana:plan | development | Same as suite installation | Restore state, resolve consequential requirement gaps, then dispatch | Starting any task; "where were we"; choosing next step | [skills/plan/SKILL.md](skills/plan/SKILL.md) |
| guarana:build | automation | Same as suite installation | Run lifecycle Frame/Run/Verify/Record, triggers, budgets, stop reasons | Starting or executing a run; run budgets; stop conditions | [skills/build/SKILL.md](skills/build/SKILL.md) |
| guarana:code | development | Same as suite installation | Implement one verified condition with minimal diffs | Implementing, editing, writing code | [skills/code/SKILL.md](skills/code/SKILL.md) |
| guarana:verify | development | Same as suite installation | Independently check acceptance criteria and evidence | Checking work, acceptance, "is it done" | [skills/verify/SKILL.md](skills/verify/SKILL.md) |
| guarana:research | research | Same as suite installation | Investigate evidence within read-only boundaries | Investigating, tracing, or comparing evidence read-only | [skills/research/SKILL.md](skills/research/SKILL.md) |
| guarana:remember | memory | Same as suite installation | Restore and record project workflow state and checkpoints | Resuming project work; restoring state after context loss; recording workflow progress | [skills/remember/SKILL.md](skills/remember/SKILL.md) |
| guarana:memory | memory | Same as suite installation | Search, review, and save durable knowledge in the memory graph | Searching/reviewing decisions, bugs, or solutions; saving durable project knowledge or standing preferences | [skills/memory/SKILL.md](skills/memory/SKILL.md) |
| guarana:skill-authoring | memory | Same as suite installation | Create or update reusable skills without duplicates | Creating, reviewing, or maintaining a Guarana-generated skill | [skills/skill-authoring/SKILL.md](skills/skill-authoring/SKILL.md) |
| guarana:memory-maintenance | memory | Same as suite installation | Audit and maintain memory graphs safely | Auditing, migrating, or pruning durable memory | [skills/memory-maintenance/SKILL.md](skills/memory-maintenance/SKILL.md) |
| guarana:debug | development | Same as suite installation | OPTIONAL — failure-mode matrix + defusals | ONLY when a test fails or a run misbehaves | [skills/debug/SKILL.md](skills/debug/SKILL.md) |
| guarana:measure | automation | Same as suite installation | OPTIONAL — telemetry, stop-reason logs, budget health | ONLY when tuning cost or reading telemetry | [skills/measure/SKILL.md](skills/measure/SKILL.md) |

Canonical bibliography: [references/sources.md](references/sources.md).
