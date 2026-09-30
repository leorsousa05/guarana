# ADR-017 — Adaptive requirements discovery before implementation

**Status:** Accepted (2026-09-28) · append-only

## Context
The planning skill restored state and routed work, but substantial requests could be treated as complete even when scope, constraints, or acceptance remained unclear. Silent assumptions create avoidable rewrites; a mandatory questionnaire on every task would slow routine work.

## Decision
`guarana:plan` performs evidence-first requirements discovery before any code dispatch. It separates known facts, low-risk inferences, and unresolved decisions; asks the human only when an unknown could materially change scope, architecture, user-visible behavior, data, integrations, security/privacy, operations, or acceptance. Ask up to five high-impact questions per round, then persist the answers in the feature spec and any durable project decision in an ADR. A worker-code dispatch is blocked while a critical unknown remains unanswered. Small, fully specified tasks proceed without a questionnaire.

## Alternatives considered
- Ask a fixed intake questionnaire for every task — rejected: redundant for precise routine changes.
- Treat the user's first sentence as the full specification — rejected: leaves consequential gaps as silent assumptions.
- Add only an explicitly invoked discovery skill — rejected: the automatic planning path must enforce the gate without requiring the user to know a special command.

## Consequences
- Planning checks existing evidence before asking and uses the question tool when available.
- Greenfield/multi-surface tasks explicitly establish outcome, boundaries, constraints, users/flows, and observable acceptance.
- Discovery stops when requirements are falsifiable; non-critical assumptions are recorded and reversible.
