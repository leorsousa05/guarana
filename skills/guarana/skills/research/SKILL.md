---
name: guarana:research
description: Use for bounded, read-only repository and documentation research when asked to investigate, trace, or compare evidence without changing files.
---

# guarana:research

The canonical read-only research procedure for the separate native Task
subagent `worker-research`.

## Scope and budget

- Address only the single assigned research question or verifiable condition.
- The default budget is **4k tokens per dispatch**. Stay within the budget; if
  the condition cannot be established within it, report the blocker and stop.
- Use only the provided condition and state pointers. Ask the primary to resolve
  an ambiguous scope or supply missing pointers rather than broadening the search.

## Read-only method

- Read and search relevant source, neighboring interfaces, tests, and project
  documentation using only `read`, `grep`, and `glob`.
- Do not edit files, run bash/shell commands, launch nested tasks, or call
  `workflow_tick`. Do not try another tool or route to bypass a denial.
- Prefer direct, authoritative sources. Cite exact paths and line references
  where available; distinguish observed facts from inference.
- Report contradictory evidence, missing sources, and search limitations
  explicitly. Do not treat an unsuccessful or unavailable lookup as proof of
  absence, and do not invent facts or citations.

## Return contract

- Answer to the assigned research question, with concise source-backed findings.
- Evidence: the inspected paths and relevant locations.
- Limitations or unresolved questions, if any.
- `stop_reason: condition-met` when the condition is established, or
  `stop_reason: error` with the exact blocker when it is not.
