# Feature spec: guarana automatic orchestrator

**Status:** SPECIFIED → IMPLEMENTED → VALIDATED
**Date:** 2026-08-31

## Goal
Turn Guarana from a manually-driven skill workflow into an automatic engineering loop. The user stops needing to invoke `guarana:plan` explicitly: an always-on orchestration layer watches the conversation, selects the right guarana skill, and drives the state machine through the existing lifecycle — planning → building → coding → verifying → debugging → completed. The existing skills stay the execution engine; the orchestrator only decides *what* to run.

## Design principles (contract from brief)
1. **Existing skills remain the capabilities.** The orchestrator never re-implements plan/build/code/verify/etc. It selects a skill and tells the model to load it via the `skill` tool; the skill body is the authority on *how* to perform the step.
2. **Thin host adapter, reusable core.** All state-machine and decision logic lives in a host-independent ESM core (`orchestrator/`). The opencode plugin (`plugin/guarana-orchestrator.js`) is a thin shell wiring lifecycle hooks to that core.
3. **Progressive disclosure preserved.** Only the **active** skill's full body is injected; the always-on block is small and names the state/skill. Non-active skill bodies stay out of context (ponytail-style: the active skill is appended every turn).
4. **Disk is the source of truth.** Workflow state persists to `.specs/state/workflow.json`; the loop resumes an unfinished workflow across turns/sessions from that file (ADR-004).
5. **Explicit `guarana:*` commands remain an escape hatch** that force a specific step.

## Architecture
- **`orchestrator/`** (new root dir, source of truth, ESM, zero deps) — host-independent core:
  - `state.js` — state machine: 7 states, transition table, `apply`, `canTransition`, skill↔state mapping, `load`/`save` (`.specs/state/workflow.json`).
  - `decide.js` — intent classification: user text + workflow + previous tool result → `{ event, state, skill, note }`. Includes explicit `guarana:*` detection, continuation detection (no needless re-plan), new-task detection, natural-language step completion, and auto verify-fail on a failed tool result.
  - `prompt.js` — builds the always-on orchestration block and resolves the active skill's full SKILL.md body for injection (`buildInjection`).
- **`plugin/guarana-orchestrator.js`** — opencode plugin (ESM, zero deps, marker header `// guarana orchestrator plugin`, never throws):
  - `chat.message` → restore workflow, decide, apply transition, persist, stage directive.
  - `experimental.chat.system.transform` → inject always-on block + the active skill's **full SKILL.md body** (ponytail mechanism — no `skill` tool call needed).
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
3. → `run_start` → `coding` → injects `guarana:code` body; model codes, `code_complete` → `verifying`.
4. Injects `guarana:verify`; model runs tests. On failure: `workflow_tick(verify_fail)` **or** `tool.execute.after` sees an errored tool result → auto `debugging`. Fix → `fix_start` → coding → re-verify → `verify_pass` → `completed`.

## Explicit commands (escape hatch)
`guarana:<skill>` in a user message forces that step regardless of current state (e.g. `guarana:verify` → `verifying`, load `guarana:verify`). This is unchanged by the orchestrator and always wins over automatic routing. `guarana:plan` still works; it is simply no longer required.

## Acceptance criteria
1. **Automatic entry.** A natural task ("Implement X") in a fresh project transitions `idle → planning` without the user invoking any skill.
2. **State machine integrity.** All 7 states + transitions exercised; illegal transitions rejected without changing state. Proof: `orchestrator/workflow.test.js`.
3. **Verify-fail auto-routes.** A verification failure (via `workflow_tick(verify_fail)` or an errored tool result while in `verifying`) reaches `debugging`; a fix returns to `verifying`; a pass reaches `completed`.
4. **Resume without re-plan.** An unfinished workflow recognized on a later turn and continued (no spurious `new_task`). 
5. **Explicit command forces a step.** `guarana:verify` → `verifying` even from `idle`.
6. **Persisted source of truth.** State survives a restart from `.specs/state/workflow.json`; corrupt/missing file degrades to idle, never throws.
7. **Progressive disclosure (ponytail-style injection).** The always-on block is small; the **active** skill's full body is injected every turn; non-active skill bodies are not in context. Proof: `buildInjection` includes `guarana:<skill> (injected)` + `# guarana:<skill>`.
8. **Bundle + dashboard.** `npm test`, `check-cli` PASS; orchestrator plugin + engine deployable via `guarana plugin install`; `/api/workflow/current` returns live state.

## Definition of done
All criteria have written proofs (unit + plugin + dashboard tests), `npm test` green, `check-cli` PASS, and the change is recorded in `.specs/changes/`.