---
name: guarana:verify
description: Use when checking work, judging pass/fail, running acceptance, or deciding "is it done". The termination skill: three guards, a criterion-by-criterion gate, and structural refusal to verify your own context's work.
---

# guarana:verify

The termination procedure loaded into the separate OpenCode Task subagent
`worker-verify`, always in a context distinct from whoever produced the work.

## The three guards (the only legitimate ways a run stops)
1. **Hard caps** — machine-enforced ceilings (tokens, iterations, wall-clock). Prevents runaway execution.
2. **Verifiable conditions** — checkable predicates defining done. Prevents "looks complete" claims.
3. **Independent verifier** — a context that did not produce the work. Prevents self-approval bias.

## Split check (first, always)
If the diff under review was produced in THIS context, REFUSE and reroute to a fresh worker-verify. No exceptions.

## The gate
Before reviewing implementation criteria, if the project has `.specs/`, run
`guarana specs validate <project-root> --json`. A nonzero exit means the specs
structure is invalid: report the validator's file-specific issues and do not
confuse a clean structural check with proof that the implementation meets its
acceptance criteria.

For each acceptance criterion in the spec:
1. Re-state the criterion's pass/fail condition.
2. Apply the falsifiability test: if this criterion's failure would be undetectable, REJECT it (hard truth 5) — e.g., "output looks reasonable" is not a criterion.
3. Demand the cited evidence (proof path, real output, diff inspection). Absence of evidence = FAIL, not neutrality.
4. Verdict per criterion: PASS or FAIL + proof path.

**Overall verdict = AND of all criteria.** Never issue a verdict without cited evidence.

## Return contract
- per-criterion PASS/FAIL + proof path
- overall verdict
- on FAIL: which criterion, why, and the reroute (worker-code for a fix; guarana:debug if the failure shows misbehavior)
