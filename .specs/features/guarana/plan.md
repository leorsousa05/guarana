# Feature / guarana:plan

## Summary
Guarana has no entry point: nothing turns "a user wants something" into a routed, budgeted dispatch across the suite. `guarana:plan` is the meta-skill that drives the SDD workflow and decides which other guarana skill fires.

## Reference links
- Siblings depended on: none (first in build order; all others depend on it).
- Knowledge: [docs/reference/reAct.md](../../../docs/reference/reAct.md), [docs/reference/outer-loop-triggers.md](../../../docs/reference/outer-loop-triggers.md)

## What it is / what it fills
**Problem:** without a router, the main thread either loads everything (blowing the progressive-disclosure budget) or guesses which skill applies.
**In scope:** reading user intent; restoring state from disk (README → project-state → decisions → current spec); choosing the next skill; writing/restating the task's verifiable condition and budget before dispatch.
**Out of scope (non-goals):** implementing changes (that is `guarana:code`), judging pass/fail (`guarana:verify`), telemetry (`guarana:measure`).

## Acceptance criteria
1. **Routing completeness.** Given any of the 7 canonical trigger phrases (one per skill), plan's body names exactly one target skill and no second skill. Proof: checklist in plan-proofs.md mapping each trigger phrase → routed skill, by inspection of `skills/guarana/skills/plan/SKILL.md`. Demo I/O: input "a test failed and the run is oscillating" → output route `guarana:debug`.
2. **State restoration order is fixed.** The body prescribes the exact read order README.md → state/project-state.md → decisions/* → current feature spec. Proof: grep of the body shows the four steps in that order. Demo I/O: fresh session with only `.specs/` on disk → agent restates current step without being told.
3. **Dispatch contract.** Every dispatch instruction in the body includes (a) the verifiable condition and (b) the subagent budget from ADR-005. Proof: body inspection finds both fields in the dispatch template. Demo I/O: dispatch of worker-code includes "verifiable condition: …; budget: 8k tokens".

## Demo criteria
Runbook: present the three trigger inputs from criterion 1 in fresh contexts; accept when each routes to the stated skill and the dispatch includes condition + budget.

## SKILL.md overview
Frontmatter: `name: guarana:plan`; description triggering on starting any task, choosing next step, restoring state, or deciding which guarana skill applies; references: `../../../docs/reference/reAct.md`. Body: restore-state checklist → intent classification table (7 rows) → dispatch template (worker, condition, budget) → stop: after dispatch, main thread waits for worker summary.

## Edge cases & constraints
- Ambiguous intent → ASK-first (Rule 0); never guess a route.
- Optional skills route ONLY on their explicit trigger.
- Budget: main-thread resident; body ≤ 150 lines; ≤ 2k tokens loaded.

## References
- External: Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models" (2022), arXiv:2210.03629.
- Internal: all six sibling skills (plan is their router).

## Definition of done
All three acceptance criteria have written proofs in proofs/plan-proofs.md, worker-verify returned PASS, and the change is recorded in `.specs/changes/`.
