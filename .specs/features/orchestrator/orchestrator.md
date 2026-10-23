# Feature spec: guarana automatic orchestrator

**Status: SPECIFIED → IMPLEMENTED → VALIDATED**
**Date:** 2026-08-31

## Goal
Turn Guarana from a manually-driven skill workflow into an automatic engineering loop. The user stops needing to invoke `guarana:plan` explicitly: an always-on orchestration layer watches the conversation, creates missing specs and memory storage, retrieves relevant memory, selects the right guarana skill, and drives the state machine through the existing lifecycle — planning → building → coding → verifying → debugging → completed. The existing skills stay the execution engine; the orchestrator only decides *what* to run.

## Design principles (contract from brief)
1. **Existing skills remain the capabilities.** The orchestrator never re-implements plan/build/code/verify/etc. It selects a skill and tells the model to load it via the `skill` tool; the skill body is the authority on *how* to perform the step.
2. **Thin host adapter, reusable core.** All state-machine and decision logic lives in a host-independent ESM core (`orchestrator/`). The opencode plugin (`plugin/guarana-orchestrator.js`) is a thin shell wiring lifecycle hooks to that core.
3. **Progressive disclosure preserved.** The always-on block is small and names state/skill. Primary-context procedures and bounded relevant memory are injected as needed; worker procedures are carried by generated Task profiles so code/verify/debug do not execute in the primary context.
4. **Disk is the source of truth.** Workflow state persists to `.specs/state/workflow.json`; the loop resumes an unfinished workflow across turns/sessions from that file (ADR-004).
5. **Explicit `guarana:*` commands remain an escape hatch** that force a specific step.

## Architecture
- **`orchestrator/`** (new root dir, source of truth, ESM, zero deps) — host-independent core:
  - `state.js` — state machine: 7 states, transition table, `apply`, `canTransition`, skill↔state mapping, `load`/`save` (`.specs/state/workflow.json`).
  - `decide.js` — intent classification: user text + workflow + previous tool result → `{ event, state, skill, note }`. Includes explicit `guarana:*` detection, continuation detection (no needless re-plan), new-task detection, natural-language step completion, and auto verify-fail on a failed tool result.
   - `prompt.js` — builds the always-on orchestration block and resolves the active primary-context skill body plus bounded memory context for injection (`buildInjection`); worker states receive Task-dispatch guidance.
  - `specs.js` — idempotently scaffolds missing `.specs/` files and a task feature spec.
- **`plugin/guarana-orchestrator.js`** — opencode plugin (ESM, zero deps, marker header `// guarana orchestrator plugin`, never throws):
  - `chat.message` → restore workflow, decide, bootstrap specs/memory, retrieve context, apply transition, persist, stage directive.
   - `experimental.chat.system.transform` → inject always-on block + relevant memory + primary-context skill body. Coding, verification, and debugging states direct the model to native Task subagents.
  - `tool.execute.after` → observe results; an error during `verifying` auto-moves to `debugging`.
  - custom tools `workflow_get` (read state) and `workflow_tick` (advance state machine deterministically).
- **Bundle**: `orchestrator/` and `plugin/guarana-orchestrator.js` added to `scripts/sync-cli-bundle.mjs` / `check-cli-bundle.mjs`; CLI `plugin install/status` deploys the plugin + orchestrator engine.
- **Dashboard**: `GET /api/workflow/current` + a Workflow panel (state strip, current skill/task/goal, transition history).

## State machine
States: `idle`, `planning`, `building`, `coding`, `verifying`, `debugging`, `completed`.

| Event | From | To |
|---|---|---|
| `new_task` | idle/completed/any active | planning |
| `plan_complete` | planning | building |
| `run_start` | building | coding |
| `code_complete` | coding | verifying |
| `verify_pass` | verifying | completed |
| `verify_fail` | verifying | debugging |
| `fix_start` | debugging | coding |
| `debug_complete` | debugging | verifying |
| `abort` | any | idle |
| `force` | any | mapped from requested skill |

Verification failure (`verify_fail`) auto-moves to debugging/correction (`fix_start` → coding) then back to verification (`debug_complete`); a passing verification (`verify_pass`) reaches `completed`. Illegal transitions are rejected (`apply` returns null) — the state machine cannot wedge.

## How the loop drives itself
1. User: *"Implement OAuth authentication"* → `chat.message` → `decide` → `new_task` → `planning`.
2. `system.transform` injects the block + **full `guarana:plan` body**. Model follows plan, calls `workflow_tick(plan_complete)` → `building`.
3. → `run_start` → `coding`; the primary calls native Task with `worker-code`, waits for its diff/stop reason, and advances `code_complete` → `verifying`.
4. The primary calls native Task with `worker-verify` in a fresh context. On failure: `workflow_tick(verify_fail)` **or** `tool.execute.after` sees an errored tool result → auto `debugging`; the primary invokes `worker-debug` only then. A fix returns through `fix_start` → coding → re-verify → `verify_pass` → `completed`.

## Explicit commands (escape hatch)
`guarana:<skill>` in a user message forces that step regardless of current state (e.g. `guarana:verify` → `verifying`, load `guarana:verify`). This is unchanged by the orchestrator and always wins over automatic routing. `guarana:plan` still works; it is simply no longer required.

## Acceptance criteria
1. **Automatic entry.** A natural task ("Implement X") in a fresh project creates the minimum `.specs/` record and memory vault, then transitions `idle → planning` without the user invoking any skill.
2. **State machine integrity.** All 7 states + transitions exercised; illegal transitions rejected without changing state. Proof: `orchestrator/workflow.test.js`.
3. **Verify-fail auto-routes.** A verification failure (via `workflow_tick(verify_fail)` or an errored tool result while in `verifying`) reaches `debugging`; a fix returns to `verifying`; a pass reaches `completed`.
4. **Resume without re-plan.** An unfinished workflow recognized on a later turn and continued (no spurious `new_task`). 
5. **Explicit command forces a step.** `guarana:verify` → `verifying` even from `idle`.
6. **Persisted source of truth.** State survives a restart from `.specs/state/workflow.json`; corrupt/missing file degrades to idle, never throws.
7. **Progressive disclosure and worker split.** The always-on block is small; primary-context skills and bounded relevant confirmed memory are injected as appropriate. Code/verify/debug procedures are present in installed Task profiles; worker states dispatch those profiles and keep their full bodies out of the primary prompt.
8. **Bundle + dashboard.** `npm test`, `check-cli` PASS; orchestrator plugin + engine and Task worker profiles deployable via `guarana plugin install`; `/api/workflow/current` returns live state.
9. **Human-readable spec lifecycle.** Planning replaces generic bootstrap content with a task-specific slug, known requirements, assumptions, scope, and falsifiable acceptance criteria before `plan_complete`; each workflow stage updates project-state and feature status; successful verification records exact proof and updates tracker status. Workflow JSON alone does not satisfy this criterion.

### Current lifecycle policy addendum

The unconditional bootstrap and per-stage project-state wording in criteria 1 and 9 above is superseded by this current policy. Pure informational/read-only requests—including audits, reviews, inspections, investigations, and reports with no requested durable mutation—do not create task feature specs or write tracker/project-state records; explicit `guarana:<skill>` commands still route to the requested skill. `worker-specs` is dispatched only when a durable human-readable record changes: planning records accepted requirements/scope when needed, intermediate handoffs record only material durable status/proof/pending-write deltas, and final verification records exact proof/status. Transient stage, budget, and current-step data stays in workflow state. Project-state records task start/end or a material blocker/status, not every stage. Validation follows a human-readable record write.

### Accepted follow-up: intent, prompt-data trust, and workflow provenance

**Slice status: IMPLEMENTED (2026-10-23; offline V2 setup correction and regression are implemented and checked; live Task isolation remains a separate pending acceptance gate, with no fresh authorized live check performed; GitHub push pending).** The parent orchestrator feature remains at its existing overall status. The bounded follow-up record and current status are in [intent and provenance safety](intent-provenance-safety.md) and the [2026-10-23 change record](../../changes/2026-10-23-orchestrator-intent-provenance-safety.md); earlier verification and deployment evidence remains historical.

The accepted offline ownership-recovery design for the stale tracked plugin is recorded in [ADR-039](../../decisions/ADR-039-explicit-plugin-ownership-adoption.md). The `plugin adopt` capability is not implemented; this decision does not authorize live recovery, installation, restart, or Task execution.

#### Requirements and assumptions

- Informational questions and consultations in Portuguese are read-only. Explicit Portuguese and English mutation requests still start tasks, and explicit `guarana:<skill>` commands still force their requested skill.
- `workflow.goal` and `workflow.activeTask` are untrusted data. They must be structurally distinguished from authoritative system rules and cannot redefine rules or worker identity when their contents resemble instructions.
- Workflow events record only the minimal provenance fields `source`, `sessionID`, and `agent`; they do not record user text, tool arguments, or tool output.
- Keep the existing project-shared workflow persisted in `.specs/state/workflow.json`, including resume across turns and sessions. Do not introduce per-session workflow isolation. Preserve native Task dispatch and worker identity semantics.
- Assumption: the current project-level persistence and native Task identity contracts remain authoritative; this follow-up changes neither contract.

#### Observable acceptance criteria

1. Core and CLI classifier tests show that Portuguese informational questions produce no `new_task`, no workflow transition, and no bootstrap call. The same suites show explicit Portuguese and English mutations still produce `new_task`, and `guarana:<skill>` still forces the selected skill.
2. Prompt tests show `goal` and `activeTask` are rendered only as explicitly untrusted data, separate from fixed authoritative rules. Adversarial instruction-like values do not alter those rules or the declared worker identity.
3. Workflow-event tests show provenance uses only `source`, `sessionID`, and `agent`, and serialized events contain no user text, tool arguments, or tool output.
4. Core/plugin tests show an unfinished workflow persisted in `.specs/state/workflow.json` resumes across distinct sessions in the same project, while native Task dispatch and its existing worker-identity behavior remain intact.
5. The focused core, plugin, and CLI regression command `node --test orchestrator/workflow.test.js orchestrator/prompt.test.js plugin/guarana-orchestrator.test.mjs cli/orchestrator/workflow.test.js cli/orchestrator/prompt.test.js` exits 0 with coverage for criteria 1–4.
6. V2 setup wires the documented top-level `ctx.session` API into child metadata lookup without depending on undocumented `ctx.client`; it recognizes direct matching `SessionInfo` with the optional `{data}` envelope/error fallback and preserves V1 nested path/query plus `{data}` compatibility.
7. The V2 setup regression uses an agentless prompt hook with top-level `session.get` and no `client` property, asserts the existing `{sessionID, directory}` argument object, and verifies workflow bytes/state remain unchanged with no bootstrap or parent-workflow injection and native Task identity intact. A fresh authorized live child invocation must leave project `workflow.json` byte-identical from start to end; the current live-isolation result fails this portion.

#### Scope boundaries and factual basis

- Implementation scope includes the accepted V2 setup adapter correction and regression alongside intent classification, prompt construction, and workflow-event provenance. Keep workflow state project-shared; do not change `.specs/state/workflow.json`'s persistence contract or native Task/worker identity behavior. Do not add user/tool content to events.
- Inspection confirmed `orchestrator/decide.js` recognizes mutable verbs in Portuguese while its read-only prefix is English-only; informational Portuguese input can therefore be classified as `new_task`. `orchestrator/prompt.js` interpolates `workflow.activeTask` and `workflow.goal` into the system block. `plugin/guarana-orchestrator.js` receives `sessionID` and `agent` in `chat.message`, but workflow events do not record their origin or those identity fields. The existing contract persists shared project workflow state for cross-turn/session resume and retains native Task and worker identity.
- These are supplied source-inspection facts, not implementation, test, runtime, or independent-verification results. No raw prompts, arguments, outputs, secrets, or identity values are recorded here.

## Definition of done
All criteria have written proofs (unit + plugin + dashboard tests), `npm test` green, `check-cli` PASS, and the change is recorded in `.specs/changes/`.
