---
name: guarana
description: Index for the Guarana engineering-loop skills. Route workflow tasks through plan/build/code/verify; use remember for project-state restoration and checkpoints, memory for searching or saving durable graph knowledge, debug for observed failures, and measure for telemetry or cost analysis.
---

# Guarana Suite Index

The automatic orchestrator is always active when Guarana is installed. It routes
workflow requests, creates missing `.specs/` records, and supplies relevant
confirmed memory. This index defines trigger boundaries and points to each skill;
the linked skill body owns its procedure. Explicit `guarana:<skill>` commands
remain an escape hatch.

| Skill | Description | Trigger | Body |
|---|---|---|---|
| guarana:plan | Restore state, discover consequential requirement gaps, ask targeted questions before coding, then dispatch | Starting any task; "where were we"; choosing next step | [skills/plan/SKILL.md](skills/plan/SKILL.md) |
| guarana:build | Run lifecycle Frame/Run/Verify/Record, triggers, budgets, stop reasons | Starting or executing a run; run budgets; stop conditions | [skills/build/SKILL.md](skills/build/SKILL.md) |
| guarana:code | Implementation: read-before-edit, minimal diff, diff + stop reason | Implementing, editing, writing code | [skills/code/SKILL.md](skills/code/SKILL.md) |
| guarana:verify | Termination gate: 3 guards, pass/fail + proof, split enforcement | Checking work, acceptance, "is it done" | [skills/verify/SKILL.md](skills/verify/SKILL.md) |
| guarana:remember | Restore and record project workflow state and checkpoints | Resuming project work; restoring state after context loss; recording workflow progress | [skills/remember/SKILL.md](skills/remember/SKILL.md) |
| guarana:memory | Search, review, and save durable knowledge in the memory graph | Searching/reviewing decisions, bugs, or solutions; saving durable project knowledge or standing preferences | [skills/memory/SKILL.md](skills/memory/SKILL.md) |
| guarana:debug | OPTIONAL — failure-mode matrix + defusals | ONLY when a test fails or a run misbehaves | [skills/debug/SKILL.md](skills/debug/SKILL.md) |
| guarana:measure | OPTIONAL — telemetry, stop-reason logs, budget health | ONLY when tuning cost or reading telemetry | [skills/measure/SKILL.md](skills/measure/SKILL.md) |

Canonical bibliography: [references/sources.md](references/sources.md).
