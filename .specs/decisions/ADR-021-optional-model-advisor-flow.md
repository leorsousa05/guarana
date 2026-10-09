# ADR-021 — Optional model advisor flow

**Status:** Accepted (2026-10-08) · append-only

## Context

The Guarana orchestrator routes work and its Task workers, but does not let a
user explicitly start work under a chosen primary model with a separate stronger
model available for advice when the primary is blocked. The user requires this
flow to be optional, configurable from both CLI and dashboard, and advisory
rather than an autonomous second executor.

## Decision

1. Keep ordinary OpenCode conversations and the existing orchestrator behavior
   unchanged; add a native OpenCode custom command as the opt-in entry point.
2. Bind that command to a configured Guarana primary agent. Use a separate
   native Task subagent for the advisor so OpenCode provides the model boundary
   and child context.
3. Let the primary decide when it cannot progress, with tool failure/retry
   evidence as additional signals. For each blocked episode it may consult the
   advisor once, passing a bounded summary of task, workflow progress, attempts,
   and relevant failures. The advisor is read-only and returns options and
   limitations; the primary remains responsible for action and workflow state.
4. Configure primary/advisor provider-model IDs and optional variants. CLI
   supports project and global settings, with project values overriding global
   values. Dashboard edits the active project's values and shows inherited
   global values. Store project preferences in `.guarana/advisor.json` and
   global preferences in `$XDG_CONFIG_HOME/guarana/advisor.json`, defaulting to
   `~/.config/guarana/advisor.json`. OpenCode remains the credential source.
5. Manage generated OpenCode commands and profiles only when marked as
   Guarana-owned; preserve the existing worker profiles and their contracts.

## Alternatives considered

- Automatically replace the active model for every chat — rejected because the
  user requires explicit opt-in and normal conversations must be unaffected.
- Let the advisor implement changes — rejected; the user asked for guidance on
  feasible actions, with the existing primary workflow continuing execution.
- Spawn advisor sessions through private OpenCode server APIs — rejected in
  favor of the native Task mechanism already used by Guarana workers.
- Pass the full conversation to the advisor — rejected in favor of relevant
  task, progress, attempt, and failure context to bound disclosure and tokens.

## Consequences

- Installation/update and uninstall must safely manage the custom command and
  agent profiles in project and global roots.
- Dashboard gains a project-scoped settings API and screen; global values are
  read for effective fallback.
- Advisor model/variant availability remains provider/model-specific; OpenCode
  owns model credentials and validation at execution time.
