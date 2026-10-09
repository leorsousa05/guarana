# Feature spec: Isolated `.specs` updates

**Status:** VALIDATED — independent worker-verify PASS (6/6), 2026-10-09
**Date:** 2026-10-09

## Goal

Move repetitive human-readable `.specs` reading and editing out of the primary
conversation context while preserving accurate lifecycle records.

## Known requirements

- The current plan and always-on prompts require the primary to maintain
  `README.md`, `state/project-state.md`, and the active feature spec at task
  planning, lifecycle transitions, and verification.
- Existing native worker profiles already isolate code, verification, and
  debugging; ADR-020 keeps the primary responsible for workflow transitions.
- The user accepts context isolation as an alternative to eliminating all total
  token cost. This change does not promise a reduction in aggregate tokens.

## Scope

- Add a dedicated hidden `worker-specs` profile generated from a compact canonical
  procedure; include it in project and global worker installation/status/uninstall.
- Route planning, milestone-status, and verified-proof writes through this worker
  with a concise factual handoff.
- Keep requirement discovery, acceptance decisions, verification, and workflow
  transitions in the primary. The worker reads and edits `.specs` records and
  returns changed paths plus the validator result; the primary need not load their
  full contents to confirm the handoff.
- Update the always-on routing rule and plan procedure; keep the worker body out of
  primary-context injection.

## Assumptions

- Task dispatch remains a model action using OpenCode's native Task tool.
- The worker must preserve unrelated records and may record only supplied
  requirements, status, and proof; it cannot invent acceptance or validation.

## Acceptance criteria

1. `worker-specs` is installed for project/global scopes, recognized as a worker,
   and generated from one canonical procedure; its profile restricts edit intent
   to `.specs` records and denies workflow transitions or nested tasks.
2. Planning instructions send task goal, requirements, assumptions, boundaries,
   and acceptance criteria to `worker-specs`; the primary no longer reads/edits
   whole `.specs` files for that lifecycle write.
3. Lifecycle and verification instructions pass only status/proof deltas to the
   worker, which updates the human-readable records without fabricating facts.
4. The primary receives a concise changed-path/validation summary, and the worker
   procedure is not injected into the primary context.
5. Tests cover profile generation/install/status/uninstall, allowed file scope,
   worker classification, and prompt routing. `npm test`, `npm run check-cli`,
   `npm run specs:validate`, and `git diff --check` pass.

## Definition of done

All criteria pass; canonical skills and CLI bundle are synchronized; the
orchestrator tracker and exact verification proof are recorded.

## Implementation checkpoint (2026-10-09)

- Native hidden `worker-specs` installed/status/uninstall integrated and identified as an isolated child in canonical plugins and CLI.
- Always-on prompt and plan skill route lifecycle writes through compact handoffs; dedicated worker skill is synchronized between canonical and CLI bundles.
- Permissions use relative patterns `.specs/README.md`, `.specs/state/*.md`, `.specs/features/*.md`, and `.specs/changes/*.md`. This corrects the diagnosed cause from worker-debug `ses_edefdafe5ffeMpnJvKE31omDBe`: `**` is not globstar, so `**/.specs/...` did not match.
- Agents installed with `guarana plugin install --project`.
- Focused tests: 39/39 and 24/24 PASS; `npm test` PASS 267/267; `check-cli`, `specs:validate` (130/19/30/208), and `git diff --check` PASS.
- Independent worker-verify `ses_edef8ddb0ffeUg2brb6lxLdS61` passed all six criteria: profile/permissions/install project-global; routing and ownership; plugin child isolation; regression tests; synchronized bundles; suite/validator.
- Verification evidence: `npm test` 267/267 PASS; `npm run check-cli` PASS; `npm run specs:validate` PASS (130 Markdown, 19 features, 30 ADRs, 208 links); `git diff --check` PASS; canonical/CLI comparisons PASS.
- Permission-blocker root cause was independently confirmed by worker-debug `ses_edefdafe5ffeMpnJvKE31omDBe`: OpenCode permission rules use `*`, not `**` globstar. Removing `**/` from worker-specs and worker-debug paths restored worker-specs writes after reload.
