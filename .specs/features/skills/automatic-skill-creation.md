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
