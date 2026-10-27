# ADR-046 — Dashboard parallel-subtask projection

**Status:** Accepted (2026-10-27) · implementation pending · append-only

## Context

Parallel subtask orchestration stores its run and task state in a sidecar that
is writable only by the primary. The Dashboard Workflow screen needs to show
the current parallel run without becoming an orchestration controller or
exposing local worktree metadata. The existing project-scoped
`GET /api/workflow/current` route is the accepted API surface.

## Decision

1. Add an additive, read-only `parallelRun` projection to the existing
   project-scoped `GET /api/workflow/current` response. Do not add a mutation
   API or dispatch Tasks from the Dashboard.
2. Select only the current workflow's DAG: its latest `run_start` after the
   latest `new_task` or `abort`. After completion, that DAG may remain current
   until another task or abort. Do not browse historical runs.
3. Return run status and update time, plus each task's `id`, `mode`, `status`,
   and `dependsOn`; the UI does not require a `runId`. Return
   `parallelRun: null` when no DAG is bound. If a DAG is bound but its manifest
   is missing, malformed, locked, unreadable, or otherwise uncertain, return a
   bounded unavailable state without raw filesystem errors and do not claim
that no DAG exists.
4. Treat the sidecar as primary-only writable state. The projection must not
   return or render `ownedPaths`, absolute worktree paths, `baseCommit`, evidence
   references, goals or conditions, prompts, worker output, raw errors, or lock
   identities. This avoids exposing local worktree metadata.
5. Show the projection in an accessible, responsive, read-only “Parallel
   subtasks” section on the Workflow screen, with run/task status, mode, and
   dependency relationships. Provide no create, retry, or cancel controls, and
   preserve existing Workflow monitor behavior and ledger styling.

## Alternatives considered

- Dashboard controls for creating, retrying, or cancelling subtasks — rejected
  because they would bypass primary-only sidecar ownership.
- Browsing all historical manifests — rejected because the accepted scope is
  the current run only.

## Consequences

The Dashboard can display safe current-run status while leaving orchestration
and all sidecar writes with the primary. It does not expose local worktree
paths or other private manifest fields, and it cannot browse historical runs
or mutate parallel tasks. Root README documentation is a primary-owned pending
write; implementation and validation remain pending in the [Dashboard Workflow
feature spec](../features/dashboard/current-parallel-subtasks.md).

## Implementation and validation outcome — 2026-10-27

The current-run projection and root README documentation are complete and
validated; fresh independent `worker-verify` passed all six criteria. The
implementation remains uncommitted; no shipment, commit, push, tag,
publication, or release is claimed. See the [validated change record](../changes/2026-10-27-dashboard-current-parallel-subtasks.md).

## Source shipment addendum — 2026-10-27

The validated implementation was shipped as source commit
`ff10f918c67ecf7c6f85287bde93bc83a9f10655`
(`feat(dashboard): add current parallel-subtask view`), parent/base
`a742d7cf7459ba1a0f006ba54e309180505b8dda`, pushed normally to
`https://github.com/leorsousa05/guarana.git` (`a742d7c..ff10f91 main -> main`).
Immediately after push, `git ls-remote origin refs/heads/main` returned the exact
commit SHA, equal to local HEAD. The existing six-criterion implementation PASS
remains its validation checkpoint. This was source shipment only: no Git tag,
npm publication/dist-tag, GitHub Release, or formal package release occurred.
