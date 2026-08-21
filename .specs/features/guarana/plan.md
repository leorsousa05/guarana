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
4. **Cold start (no `.specs/` on disk).** Given a project with no `.specs/` directory, plan's body must not fabricate a restored state; it must detect the cold start, run Rule 0 (record the contract answers as ADRs), scaffold the initial tracker + project-state, and only then route. Proof: inspection of the cold-start branch in `skills/guarana/skills/plan/SKILL.md` shows the no-fabricate → Rule 0 → scaffold → route sequence. Demo I/O: fresh project with no `.specs/` → agent asks the Rule-0 questions and records ADRs before classifying intent.
5. **No ADR pre-seed on cold start.** Scaffolding creates `.specs/decisions/` EMPTY and explicitly forbids copying or pre-seeding ADRs from any other project or template (e.g. a guarana baseline); ADRs are generated ONLY from this project's actual Rule-0 answers, numbered organically from 001. Proof: grep of the cold-start branch in `skills/guarana/skills/plan/SKILL.md` finds "EMPTY", "Do NOT copy or pre-seed", and "numbered organically from 001". Demo I/O: fresh project with no `.specs/` → `.specs/decisions/` is scaffolded empty; no baseline ADRs appear before Rule-0 answers are recorded.
6. **Legacy spec-tree recovery (migration).** When restore finds no `.specs/` but a legacy spec tree is recoverable (a `specs/` dir in the working tree, or `.specs/` content in git HEAD — deleted/renamed files), plan must not discard it: it recovers the legacy content as the project's initial feature-spec context, scaffolds the new `.specs/` system of record around it, and treats the situation as a migration. A pure cold start (no legacy anywhere) is bare scaffold + Rule-0 ADRs only. Proof: inspection of the cold-start branch shows it distinguishes the legacy-recoverable (migration) and no-prior-state (pure) sub-cases. Demo I/O: working tree has a legacy `specs/` but no `.specs/` → agent recovers the legacy content as initial feature context before scaffolding.

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
All six acceptance criteria have written proofs in proofs/plan-proofs.md, worker-verify returned PASS, and the change is recorded in `.specs/changes/`.
