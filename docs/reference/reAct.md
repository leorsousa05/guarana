# ReAct — Reasoning + Acting

Source: Yao et al. (2022), arXiv:2210.03629.

## The shape
Each inner-loop step is a triple: **Thought → Action → Observation**. The thought makes the decision inspectable; the observation grounds the next thought in reality instead of the model's prior.

## Why guarana cares
- Thoughts are where verifiable conditions live: before acting, restate what checkable predicate this action serves.
- Observations are the anti-hallucination mechanism — a step that skips observation is guessing.
- ReAct alone has no stopping rule. Guarana adds one: stopping is checked by machinery (guarana:verify's three guards), never by the iterator.

## Variants
- **Plan-and-execute:** plan once, execute many. Cheaper, but brittle when the plan meets reality — re-Frame (guarana:build) on plan violation.
- **Tree-of-thought:** branch candidate thoughts, evaluate, prune. Use sparingly; each branch spends budget.
