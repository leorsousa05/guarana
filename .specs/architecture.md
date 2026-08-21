# Guarana — Runtime Architecture

## Progressive disclosure
The suite index `skills/guarana/SKILL.md` holds ONLY: per skill — name, one-line description, trigger, and its reference path. Total cost: a few hundred tokens. Full skill bodies load into context ONLY when their trigger fires. The main thread never holds all skills at once; steady-state cost is the tiny index plus the 1–2 skills actually firing this turn.

## Subagent topology
The main thread is a thin orchestrator: it holds the index + `guarana:plan`, makes decisions, and dispatches heavy work to worker subagents that are discarded after returning a summary.

| Worker | Loads | Returns |
|---|---|---|
| worker-code | `guarana:code` | diff + stop reason |
| worker-verify | `guarana:verify` | pass/fail + proof |
| worker-debug | `guarana:debug` (only when a failure fires) | root cause + fix |

## Verification split (structural)
worker-code and worker-verify are separate contexts with separate budgets. The subagent that wrote a change is never the one that approves it. This is not a convention — it is the topology. See ADR-003.

## Budgets (defaults recorded in ADR-005; human may override)
- Main thread: small — index (~300–500 tokens) + plan body + active worker summaries; target ≤ 8k tokens steady-state.
- worker-code: 8k tokens per dispatch.
- worker-verify: 4k tokens per dispatch.
- worker-debug: 6k tokens per dispatch.
- Per-run cap (hard ceiling per outer-loop rotation): 32k tokens / 15 min wall-clock.

## State read/write during production
- worker-code reads the current feature spec; writes `skills/guarana/**` and appends proofs to `.specs/features/guarana/proofs/`.
- worker-verify reads specs + proofs; writes pass/fail verdicts into proofs (appended, attributed) and returns the verdict.
- worker-debug reads `.specs/state/known-issues.md` and failing transcripts; appends new issue entries.
- The main thread writes `.specs/state/project-state.md` and `.specs/changes/` at task end only.
