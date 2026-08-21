# Guarana

Guarana is an installable AI skill suite for [OpenCode](https://opencode.ai/) that implements the **AI Loop Engineering** paradigm: the disciplined design of an agent's inner loop (Perceive → Think → Act → Observe) and the outer loop that supervises whole runs.

The suite gives any OpenCode agent a rigorously-specified, progressively-disclosed set of skills that make agent runs **stoppable**, **verifiable**, and **memorable** — with all state on disk, never in context.

## Skills

### Core skills (always available)

| Skill | Use when |
|---|---|
| `guarana:plan` | Starting or resuming a task, deciding the next step, choosing which skill applies. |
| `guarana:build` | Starting or executing a run, managing run lifecycle and stop conditions. |
| `guarana:code` | Implementing, editing, or writing code as a dispatched worker. |
| `guarana:verify` | Checking work, judging pass/fail, running acceptance. |
| `guarana:remember` | State, memory, session resume, or context loss. |

### Optional skills (trigger-only)

| Skill | Use when |
|---|---|
| `guarana:debug` | A test fails or a run misbehaves. Never load on green runs. |
| `guarana:measure` | Tuning cost or reading telemetry. Never load during ordinary build runs. |

## Repository layout

```
.
├── skills/guarana/        # Runtime skill suite (OpenCode SKILL.md files)
├── .specs/                # System of record: specs, proofs, ADRs, state
├── docs/reference/        # Knowledge files (ReAct, Reflexion, outer-loop, memory, failure modes)
└── human-gate-validation.md
```

## Documentation

- `.specs/README.md` — master tracker and entry point for the system of record.
- `.specs/project.md` — build contract, hard truths, Rule 0.
- `.specs/architecture.md` — progressive disclosure, subagent topology, budgets.
- `docs/reference/` — canonical background on ReAct, Reflexion, outer-loop triggers, memory, and failure modes.

## Status

All 7 skills are specified, audited, implemented, validated, and shipped. See `.specs/README.md` for the current state and `human-gate-validation.md` for the human final gate record.

## License

TBD
