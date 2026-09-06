# 2026-08-31 — automatic orchestrator (always-on engineering loop)

New always-on Guarana orchestration layer. Turns the manually-driven skill workflow into an automatic loop: a user types "Implement OAuth" and Guarana enters planning, builds, codes, verifies, and auto-routes failures to debugging — without invoking any skill. Existing skills remain the execution engine; the orchestrator only decides *what* to run. All verified: `npm test` 156/156, `check-cli` PASS, frontend builds.

## Core (`orchestrator/`, host-independent, zero deps)
1. **`state.js`** — explicit 7-state machine (`idle/planning/building/coding/verifying/debugging/completed`), legal-transition table, `apply`/`canTransition`, skill↔state mapping, and `load`/`save` against `.specs/state/workflow.json` (disk is the source of truth; corrupt/missing → idle, never throws). Illegal transitions are rejected, so the machine cannot wedge.
2. **`decide.js`** — intent → `{ event, state, skill, note }`: explicit `guarana:*` force, new-task detection, continuation detection (no needless re-plan of an active task), natural-language step completion, and auto `verify_fail` when a previous tool result errored during verification.
3. **`prompt.js`** — always-on orchestration block + **full active-skill SKILL.md injection** (ponytail mechanism: `buildInjection` appends the active skill's complete body every turn, so the model has it in context without a `skill` tool call).

## Plugin (`plugin/guarana-orchestrator.js`, thin opencode adapter)
4. `chat.message` → restore persisted workflow, decide, apply transition, persist, stage directive.
5. `experimental.chat.system.transform` → inject the always-on block + the **active skill's full body** (ponytail mechanism); no `skill` tool call required. Full body for non-active skills stays out of context.
6. `tool.execute.after` → an errored result while `verifying` auto-moves to `debugging` (verify-fail → debug → fix → re-verify).
7. Custom tools `workflow_get` (read state) and `workflow_tick` (deterministic progression: `plan_complete`, `code_complete`, `verify_pass/fail`, etc.).

## Bundle + CLI
8. `orchestrator/` + orchestrator plugin added to `sync/check-cli` mappings; `guarana plugin install/status/uninstall` deploys the plugin and orchestrator engine (project or global), guarded by marker `// guarana orchestrator plugin`.

## Dashboard
9. `GET /api/workflow/current` (server lib `workflow.js` + route) reads live state; new **Workflow** panel (state strip with transition edges, current skill/task/goal/condition, transition history). Sidebar + App wired.

## Files
- `orchestrator/` (new): `state.js`, `decide.js`, `prompt.js`, `workflow.test.js` (22 tests)
- `plugin/guarana-orchestrator.js` (new) + `guarana-orchestrator.test.mjs` (10 tests)
- `plugin`/`dashboard/server/lib/workflow.js` + `routes/workflow.js` + `lib/workflow.test.js` (4 tests)
- `dashboard/web/src/components/Workflow.jsx` (new), `Sidebar.jsx`, `App.jsx`, `style.css`
- `scripts/sync-cli-bundle.mjs`, `scripts/check-cli-bundle.mjs`, `cli/constants.js`, `cli/lib/guard.js`, `cli/lib/paths.js`, `cli/commands/plugin.js`, `package.json` (test glob)
- bundle re-synced; plugins + engines redeployed

## Behavior notes
- **Explicit `guarana:*` still wins** (escape hatch) and forces a step from any state.
- **Resume**: an unfinished workflow is continued from disk on the next turn without re-planning, unless the user starts a brand-new task.
- **Injection (ponytail-style)**: only the **active** skill's full body is injected every turn; non-active skill bodies stay out of context.

## Verification
- `npm test` 159/159 (25 core + 10 plugin + 4 dashboard + 120 prior); `npm run check-cli` PASS; `npm run build:dashboard` clean.
- `guarana plugin install/status --project` confirmed: orchestrator plugin + engine deploy and report up-to-date.
- End-to-end smoke through deployed plugin: "Implement OAuth" injects full `guarana:plan` body (`# guarana:plan` + `(injected)` marker + `plan_complete`).
- Version bumped 0.6.3 → 0.6.4 (ADR-007).