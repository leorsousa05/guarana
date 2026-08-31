---
name: guarana
description: Index for the guarana AI Loop Engineering skill suite. Always loaded; routes to guarana:plan/build/code/verify/remember (core) and guarana:debug/measure (optional, trigger-only).
---

# Guarana Suite Index

This file is the ONLY always-resident part of the suite. Load a skill body below ONLY when its trigger fires.

| Skill | Description | Trigger | Body |
|---|---|---|---|
| guarana:plan | Restore state, classify intent, dispatch with condition + budget | Starting any task; "where were we"; choosing next step | [skills/plan/SKILL.md](skills/plan/SKILL.md) |
| guarana:build | Run lifecycle Frame/Run/Verify/Record, triggers, budgets, stop reasons | Starting or executing a run; run budgets; stop conditions | [skills/build/SKILL.md](skills/build/SKILL.md) |
| guarana:code | Implementation: read-before-edit, minimal diff, diff + stop reason | Implementing, editing, writing code | [skills/code/SKILL.md](skills/code/SKILL.md) |
| guarana:verify | Termination gate: 3 guards, pass/fail + proof, split enforcement | Checking work, acceptance, "is it done" | [skills/verify/SKILL.md](skills/verify/SKILL.md) |
| guarana:remember | Disk memory: restore order, write triggers, truncation recovery | State, memory, session resume, context loss | [skills/remember/SKILL.md](skills/remember/SKILL.md) |
| guarana:memory | Memory vault: query, save decisions, review drafts, pull-only | Using/querying the memory vault; recovering prior decisions/bugs | [skills/memory/SKILL.md](skills/memory/SKILL.md) |
| guarana:debug | OPTIONAL — failure-mode matrix + defusals | ONLY when a test fails or a run misbehaves | [skills/debug/SKILL.md](skills/debug/SKILL.md) |
| guarana:measure | OPTIONAL — telemetry, stop-reason logs, budget health | ONLY when tuning cost or reading telemetry | [skills/measure/SKILL.md](skills/measure/SKILL.md) |

Canonical bibliography: [references/sources.md](references/sources.md).
