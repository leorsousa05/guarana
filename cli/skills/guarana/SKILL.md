---
name: guarana
description: Index for the guarana AI Loop Engineering skill suite. Always loaded; automatically routes natural tasks through plan/build/code/verify and uses persistent memory/specs, with guarana:debug/measure available for failures and measurement.
---

# Guarana Suite Index

The automatic orchestrator is always active when Guarana is installed. It routes
natural task requests, creates missing `.specs/` records, and supplies relevant
confirmed memory. Explicit `guarana:<skill>` commands remain an escape hatch.

| Skill | Description | Trigger | Body |
|---|---|---|---|
| guarana:plan | Restore state, discover consequential requirement gaps, ask targeted questions before coding, then dispatch | Starting any task; "where were we"; choosing next step | [skills/plan/SKILL.md](skills/plan/SKILL.md) |
| guarana:build | Run lifecycle Frame/Run/Verify/Record, triggers, budgets, stop reasons | Starting or executing a run; run budgets; stop conditions | [skills/build/SKILL.md](skills/build/SKILL.md) |
| guarana:code | Implementation: read-before-edit, minimal diff, diff + stop reason | Implementing, editing, writing code | [skills/code/SKILL.md](skills/code/SKILL.md) |
| guarana:verify | Termination gate: 3 guards, pass/fail + proof, split enforcement | Checking work, acceptance, "is it done" | [skills/verify/SKILL.md](skills/verify/SKILL.md) |
| guarana:remember | Disk memory: restore order, write triggers, truncation recovery | State, memory, session resume, context loss | [skills/remember/SKILL.md](skills/remember/SKILL.md) |
| guarana:memory | Memory vault: automatic context, query, save decisions, review drafts | Using/querying the memory vault; recovering prior decisions/bugs | [skills/memory/SKILL.md](skills/memory/SKILL.md) |
| guarana:debug | OPTIONAL — failure-mode matrix + defusals | ONLY when a test fails or a run misbehaves | [skills/debug/SKILL.md](skills/debug/SKILL.md) |
| guarana:measure | OPTIONAL — telemetry, stop-reason logs, budget health | ONLY when tuning cost or reading telemetry | [skills/measure/SKILL.md](skills/measure/SKILL.md) |

Canonical bibliography: [references/sources.md](references/sources.md).
