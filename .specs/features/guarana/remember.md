# Feature / guarana:remember

## Summary
The model forgets between runs and contexts silently truncate. `guarana:remember` is the memory skill: all durable state on disk, an explicit restoration round-trip, and detection of silent context truncation.

## Reference links
- Depends on: [plan.md](plan.md) (restoration is step one of every dispatch).
- Serves: all siblings (they read/write through it).
- Knowledge: [docs/reference/memory.md](../../../docs/reference/memory.md)
- Decision: [ADR-004](../../decisions/ADR-004-memory-location.md)

## What it is / what it fills
**Problem:** facts kept in context are lost between sessions and — worse — silently dropped mid-session by truncation, producing agents that contradict their own earlier decisions without noticing.
**In scope:** the write path (what must be persisted, where, when); the read path (restoration order); silent-truncation handling (checkpoint summaries + integrity markers).
**Out of scope:** semantic/vector search (rejected in ADR-004); telemetry storage (`guarana:measure` writes its own logs through these rules).

## Acceptance criteria
1. **Fixed restoration order.** The body prescribes README.md → state/project-state.md → decisions/* → current feature spec as the only restore sequence. Proof: body inspection finds the order. Demo I/O: cold-start agent restores current step with no user hint.
2. **Write triggers enumerated.** The body lists when state MUST be written: end of task, every stop (stop reason), every decision (ADR append), every discovered failure (known-issues). Proof: checklist of the four triggers. Demo I/O: a task end without a state write is flagged as a violation by the body itself.
3. **Silent-truncation procedure.** The body defines a detection + recovery step: periodic checkpoint of open facts to disk; on restore, a mismatch between expected and found checkpoint triggers re-read from disk, never reconstruction from memory. Proof: body inspection finds the procedure. Demo I/O: truncated context resumes from checkpoint file, not from recalled facts.

## Demo criteria
Runbook: cold-start restoration test and a simulated truncation (drop mid-run context, restore from checkpoint); accept when the agent's stated position matches disk both times.

## SKILL.md overview
Frontmatter: `name: guarana:remember`; description triggering on state, memory, session resume, "where were we", persistence, context loss; references `docs/reference/memory.md`. Body: restore sequence → checkpoint cadence → write triggers (the four) → truncation detection & recovery. Gotcha: anything only in context is treated as nonexistent (ADR-004).

## Edge cases & constraints
- Conflicting disk vs. context → disk wins, always.
- Budget: ≤ 2k tokens loaded; state writes are small appends, never rewrites of committed proofs.

## References
- External: Shinn et al., Reflexion (arXiv:2303.11366) — episodic memory as the persistence model.
- Internal: `guarana:plan`, `guarana:build`, `guarana:verify`.

## Definition of done
All three acceptance criteria proven in proofs/remember-proofs.md, worker-verify PASS, change recorded.
