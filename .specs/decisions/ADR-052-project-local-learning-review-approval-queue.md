# ADR-052 — Project-local learning-review approval queue

**Status:** Accepted (2026-11-26) · implementation pending · append-only

## Context

Learning-review memory and skill proposals currently depend on a session-bound
approval map, which is ephemeral across session or process restart. Legacy
memory graph drafts cannot represent skill proposals. Pending proposals must
remain distinct from confirmed memory so that review does not pollute the
confirmed graph.

This decision adds durable proposal review to the existing intent-driven skill
creation and learning-review service-authentication boundaries recorded in
[ADR-019](ADR-019-intent-driven-skill-creation.md) and
[ADR-049](ADR-049-learning-review-service-authentication.md); it does not revise
their historical receipts.

## Decision

Store learning-review memory proposals and project-scope skill create/update
proposals exactly in a persistent per-project approval queue under the existing
Git-ignored project memory area. Keep pending proposal data separate from both
the confirmed memory graph and legacy graph drafts. The queue survives session
and process restart.

The accepted feature scope for CLI review, Dashboard review, and the
`learningReview.autoAccept` setting is recorded in the [learning-review
approval queue feature](../features/cli/learning-review-approval-queue.md).

## Alternatives considered

- Keep proposals in the session-bound approval map — rejected because it is
  ephemeral and does not persist across session or process restart.
- Store proposals in legacy memory graph drafts — rejected because drafts cannot
  represent skill proposals, and pending proposal data must not pollute confirmed
  memory.

## Consequences

Pending learning-review proposals have durable project-local storage independent
of confirmed memory. CLI and Dashboard review must remain bound to the selected
project. No data migration, package release, Git push, or external service is
part of this decision.
