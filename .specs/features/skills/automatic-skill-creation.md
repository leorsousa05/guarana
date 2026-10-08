# Feature spec: automatic skill creation and dashboard inventory

**Status:** VALIDATED
**Date:** 2026-10-05

## Goal

When a conversation establishes a reusable, specialized way of working, let the
assistant create an OpenCode skill without requiring a separate command. Let the
assistant choose whether the skill belongs globally or only to the current
project, and make generated skills inspectable in the dashboard.

## Known requirements

- Skill creation is intent-driven like memory capture; ordinary one-off tasks do
  not become skills.
- The assistant chooses `global` or `project` scope.
- Dashboard navigation gets a **Skills** section with separate **Global** and
  **Project** tabs.

## Inferred defaults

- A skill is a reusable procedure or specialized workflow; durable decisions and
  response preferences remain memories.
- Global skills live in `~/.agents/skills/<name>/SKILL.md`; project skills live
  in `<project>/.opencode/skills/<name>/SKILL.md`, following the existing
  OpenCode discovery roots.
- The dashboard lists only skills created by Guarana, marked in SKILL.md
  metadata, and shows their description and full content. Guarana's bundled
  suite and unrelated manually authored skills are excluded.
- Strong reusable-workflow intent is sufficient to create a skill without an
  extra approval step. Existing names are never overwritten; the assistant must
  inspect available skills and avoid duplicates.
- The dashboard server binds only to loopback because the new API returns private
  global skill content.

## Scope

- Add a model-directed capture policy plus list/create tools to the memory plugin.
- Validate names, scope, size, frontmatter, and secret-shaped content before
  creating a native OpenCode skill file.
- Bundle and deploy the skill engine with the plugin for global and project
  installations.
- Add a read-only dashboard API and a Skills section with Global/Project tabs.
- Add focused engine, plugin, API, and dashboard checks; update CLI bundle and
  feature documentation.

## Out of scope

- Editing or deleting skills from the dashboard.
- Generating skills for one-off tasks, storing raw conversation transcripts, or
  copying manually authored skills between scopes.
- Immediate activation of a just-created skill during the same model turn; it is
  available through normal OpenCode discovery on subsequent turns/sessions.

## Acceptance criteria

1. The memory plugin's injected policy distinguishes reusable procedures from
   memories and one-off work, directs automatic `skill_create` use only when
   there is a clear reusable workflow, explains global-vs-project selection,
   and requires checking for duplicates first.
2. `skill_list` returns generated skill names/descriptions and scope without
   exposing absolute filesystem paths. `skill_create` writes valid SKILL.md
   files under the correct OpenCode root, tags them as Guarana-generated, rejects
   traversal/invalid names, unsupported scopes, duplicate names, malformed or
   oversized content, and secret-shaped content, and never overwrites a file.
3. The plugin's tests cover successful global and project creation, scope
   isolation, listing, duplicate protection, invalid input, and secret rejection.
4. The CLI plugin installer deploys and removes the skill engine beside the
   plugins; plugin status reports the engine; the canonical and packaged bundles
   pass `npm run check-cli`.
5. `GET /api/skills` returns only Guarana-generated skills, separated into
   `global` and `project`, including safe display fields and full Markdown for
   reading. Missing directories return empty arrays; the response contains no
   absolute paths.
6. Dashboard navigation includes **Skills**. Its accessible tabs are **Global**
   and **Project**; each lists and opens the corresponding skill content, and
   empty/error states are visible.
7. The running dashboard binds to `127.0.0.1`; global skill content is not
   reachable over the local network.
8. Focused engine/API/UI checks, `npm test`, production dashboard build, CLI
   bundle validation, and `.specs` validation pass. Feature proof records exact
   results.

## Verification proof

- `npm test` — PASS, 201 tests, 0 failures.
- `npm run build` — PASS, Vite production build and CLI bundle synchronization.
- `npm run check-cli` — PASS, canonical and packaged bundles match.
- `npm run specs:validate` — PASS, 100 Markdown files, 14 feature specs, 19
  ADRs, and 143 local links validated after final proof and change records.
- `GUARANA_OPENCODE_SMOKE=1 npm run smoke:pack` — PASS, packed CLI and generated
  project skill discovery on OpenCode 1.18.34; this smoke is providerless.
- Final `npm run specs:validate` after recording the change ledger — PASS with
  100 Markdown files, 14 feature specs, 19 ADRs, and 143 local links.
- Independent worker-verify: criteria 1–8 PASS; overall AND verdict PASS. The
  criterion-8 recheck independently confirmed the recorded commands, status/link
  consistency, providerless host-smoke boundary, and a fresh specs-validation pass.
- Release-only gate: a provider-backed fresh OpenCode session against the actual
  1.0.0 candidate remains required before publishing/tagging.

## Trigger-guidance refinement (2026-10-05)

The original automatic policy and implementation are validated above. This
follow-up makes the model's threshold easier to apply consistently without
changing ADR-019 or requiring an explicit skill-creation command.

### Acceptance criteria

1. The always-on policy gives concrete positive signals: a repeatable sequence,
   specialized checks/methods intended for future similar work, or a user
   correction clearly meant to govern future tasks. One message can qualify when
   it clearly establishes future reuse; repeated asks are not required.
2. The policy gives concrete non-signals: a detailed one-off deliverable,
   temporary acceptance criteria, generic best practices, technical complexity
   alone, or a simple task. If future reuse is ambiguous, do not create a skill.
3. The policy explicitly routes durable preferences and decisions to memory,
   procedures to skills, and scopes repository-specific methods to Project and
   portable methods to Global. It includes one positive and one negative example.
4. Focused policy tests assert these distinctions; canonical and CLI plugin copies
   match, and tests/build/bundle/spec validation pass.

### Implementation checks

- `node --test plugin/guarana-memory.test.mjs` — PASS, 9/9.
- `npm test` — PASS, 201/201 tests across 43 suites.
- `npm run build` — PASS, Vite build and CLI bundle synchronization.
- `npm run check-cli` — PASS.
- Final `npm run specs:validate` — PASS, 103 Markdown files, 15 feature specs,
  19 ADRs, and 148 local links after the trigger-guidance change record.
- Independent worker-verify — all four refinement criteria PASS; overall AND
  verdict PASS. It specifically confirmed the simple-task non-signal and the
  assertions for each positive and negative trigger.

## Skill routing clarity follow-up (2026-10-07)

### Goal

Make the actual skill-selection boundaries easier to follow and test, grounded
in the plugin's workflow state machine, prompt injection, and native skill
descriptions.

### Requirements and boundaries

- Distinguish `guarana:remember` (restore/persist project workflow state and
  recover from context loss) from `guarana:memory` (search, inspect, and save
  durable knowledge in the memory graph).
- State the source-of-truth boundary: the orchestrator/index selects and points;
  the active skill body supplies the procedure; avoid restating the procedure in
  the router.
- Test both expected and unexpected skill-selection/injection cases for
  `debug` and `measure`; debug follows observable failures, while measure is
  reserved for telemetry/cost analysis and is not a workflow state.
- Preserve different skill lengths when their responsibilities justify them;
  edit only concrete trigger ambiguity or demonstrated duplication/no-op.
- Attempt `opencode run` behavioral checks where the installed host and provider
  permit them. Report unavailable infrastructure as a test limitation, not a
  pass.
- Do not change unrelated runtime behavior, memory data, or user-authored
  skills.

### Acceptance criteria

1. Index descriptions and the two memory-related skill descriptions expose
   distinct, positive triggers for state-resume versus graph-memory work, with
   focused assertions for both.
2. Router/index/orchestrator guidance names responsibilities without duplicating
   skill procedures; tests show the selected active skill body is what gets
   injected for the covered workflow states.
3. Focused tests assert debug activation after verification failure and measure's
   positive telemetry/cost trigger contract; OpenCode behavior checks exercise
   model routing for both plus non-activation for ordinary/green work.
4. Skill lengths remain responsibility-driven; any prose change has a specific
   trigger, duplication, or no-op rationale.
5. Canonical and CLI plugin/skill artifacts are synchronized; focused tests,
   full tests, build, bundle check, specs validation, and any attempted
   `opencode run` smoke have exact outcomes recorded before validation.

### Status

VALIDATED.

### Implementation and validation evidence

- `node --test orchestrator/workflow.test.js` — PASS, 33/33.
- `npm test` — PASS, 204/204 tests across 43 suites.
- `node --test cli/orchestrator/workflow.test.js cli/orchestrator/prompt.test.js` — PASS, 34/34.
- `npm run build` — PASS; dashboard production build and `skills/guarana` synchronization into `cli/skills/guarana`.
- `npm run check-cli` — PASS; canonical and CLI bundle match.
- `npm run specs:validate` — PASS, 104 Markdown files, 15 feature specs, 19 ADRs, 151 local links.
- Five `opencode run --pure --format json` behavior checks with current skill files attached — PASS. Exact scenario → returned answer:
  - “Where did we leave off in the project and what checkpoint is next?” → `guarana:remember — Restores project state and identifies the next checkpoint.`
  - “Search the graph for previous OAuth decisions and save a durable decision.” → `guarana:memory — it handles searching graph decisions and saving durable decisions.`
  - “A test fails repeatedly with the same error; identify the failure mode and defuse it.” → `guarana:debug — It classifies repeated failures and applies the matching defusal.`
  - “Calculate stop-reason distribution and token utilization to tune the budget.” → `guarana:measure — it defines stop-reason distribution and budget utilization calculations.`
  - “A routine feature implementation passed its tests” → `neither — tests passed, so it’s an ordinary build run, not debugging or telemetry analysis.`
- `opencode run` invocation form: `opencode run --pure --format json "<scenario-specific prompt>" -f skills/guarana/SKILL.md -f skills/guarana/skills/<skill>/SKILL.md ...`; the attached docs were the current source files, and the scenarios/results above are the raw final text outputs.
- Prose-change rationale: the index description and trigger cells now split the previously overlapping state-resume and graph-query branches; its added router sentence states pointer/procedure ownership without copying a procedure. The `remember` description replaces the broad shared “memory” trigger with project state/checkpoints and its opening sentence names that same concept; `memory` now names graph search/review/save operations. The `memory` procedure body, `debug`/`measure` bodies, and skill sizing were not changed in this follow-up. Existing unrelated working-tree edits in the memory body were preserved.
- Independent review with the exact artifact set attached — PASS, all five criteria. It confirmed distinct trigger language and assertions; router/procedure boundary and active-body injection; test contracts plus recorded model outputs; prose-change rationale; and source/CLI parity with all proof records. The initial review pass requested behavior outputs and line-specific rationale; those proof gaps were recorded and the independent check was repeated successfully.
