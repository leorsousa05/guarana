# ADR-020 — Native Task dispatch for workflow workers

**Status:** Accepted (2026-10-07) · append-only

## Context

The workflow skills and architecture promise distinct worker-code and
worker-verify contexts, but the current orchestrator plugin only changes state
and injects a skill body into the primary conversation. It does not launch a
subagent, so the documented isolation is not structurally realized.

## Decision

1. The primary OpenCode model invokes the native Task tool for worker-code,
   worker-verify, and failure-only worker-debug.
2. Guarana's plugin remains responsible for persisted workflow state, routing,
   memory, and active-skill injection. The primary agent remains responsible for
   advancing workflow state after inspecting each worker's return.
3. Guarana installs named hidden subagent profiles in the OpenCode project/global
   agent roots. Their prompts are generated from the canonical worker skill
   bodies so the skill remains the procedure source of truth.
4. If the Task tool is unavailable or denied, the run reports a blocker rather
   than performing code or verification in the same context.
5. Task child sessions are excluded from the parent workflow hooks and cannot
   mutate the parent's workflow state; only the primary advances the state
   machine after inspecting worker returns.
6. Duplicate plugin copies process a given parent user-message ID at most once;
   the Task child message is excluded by its agent/parent-session identity.

## Alternatives considered

- Plugin-managed spawning through private session/server APIs — rejected for this
  iteration because the host-native Task tool already provides subagent contexts
  and avoids a second orchestration/session lifecycle in the plugin.
- Prompt-only wording with no installed worker profiles — rejected because it
  leaves roles, permissions, and skill instructions implicit and does not provide
  discoverable Task targets.
- Same-context execution with a “worker” label — rejected because it cannot
  satisfy the separate-context verification contract in ADR-003.

## Consequences

- Worker isolation is provided by OpenCode's Task tool; actual dispatch remains a
  model action governed by Task-tool permission and the orchestration prompt.
- Installation must safely manage worker profile files in both supported scopes.
- Real-host acceptance requires a provider-backed smoke that observes child
  sessions and the code/verify separation.
