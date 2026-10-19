# Feature spec: Isolated `.specs` updates

**Status: VALIDATED**
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

## Authorized follow-up: right-sized spec writes and ownership

The existing isolation work remains the validated baseline. This follow-up is
IMPLEMENTED; fresh independent verification remains pending, and shipping is
not claimed. Preserve the already-pending recorder source/test work and
unrelated worktree changes.

### Scope and boundaries

- Reduce unnecessary worker/spec writes; narrow ADR and known-issue triggers;
  exempt pure informational/read-only requests from task-spec creation; shorten
  duplicated always-on policy; reconcile ownership documentation; remove the
  duplicate recorder tracker row.
- Reuse the existing `.specs/features/orchestrator/spec-update-isolation.md`
  for this follow-up. Existing matching feature specs remain the records for
  durable code/documentation changes.
- No installed/global profile changes, external deployment, commit, push,
  version bump, tag, publish, or source release is authorized.
- The exact `.specs/architecture.md` edit permission and regression test are now
  present; worker-specs may correct its ownership sentence to match the durable
  record ownership policy.

### Acceptance criteria

1. Tests establish that pure informational/read-only questions, audits,
   reviews, inspections, investigations, and reports with no requested
   product/document/configuration mutation create neither a task feature spec
   nor tracker/project-state writes. Clear mutation verbs and explicit
   `guarana:<skill>` commands still enter the normal workflow. Durable
   code/document changes to behavior or contracts reuse a matching feature
   spec or create one when none exists.
2. Worker-specs dispatch occurs only when a human-readable durable record
   changes: planning when requirements or feature scope need recording, final
   verification for proof/status, and intermediate handoff for a material
   durable status/proof/pendingWrites change. Transient stage, budget, and
   current-step data stays in operational workflow JSON. Validation follows
   actual human-readable record writes.
3. ADR policy requires a durable architectural, contract, data, security,
   privacy, or integration decision with material alternatives; tactical
   implementation choices do not trigger ADRs. Known-issues policy requires a
   confirmed reproducible product failure with a useful durable mitigation and
   excludes tool/verifier scope errors and transient permission/environment
   failures. Actual build runs retain stop-reason logging.
4. Project-state records task start/end or a material blocker/status, not every
   stage transition. The always-on prompt is concise and points to
   `guarana:plan` for the full procedure. Worker-code and worker-verify context
   separation, worker-debug's actionable-failure gate, and generated canonical
   worker profiles remain intact.
5. The existing isolation/orchestrator feature records and reference docs state
   consistent ownership and write cadence. The architecture ownership sentence
   is corrected only after worker-code supplies the exact edit permission and
   regression test.
6. The README contains no `Deterministic .specs Record Command` duplicate row;
   the existing `Guarana spec record automation` row carries VALIDATED status
   and the supplied final worker-verify PASS / 19-of-19 test evidence. Existing
   recorder source/test changes and unrelated worktree edits remain intact.

Next step: fresh independent worker-verify of this implementation.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall AND PASS 6/6: read-only status inquiries, durable record cadence, ADR/known-issue boundaries, compact prompt, generated worker profiles/role isolation/permission regression, and ownership/current records all passed.; npm test PASS 497/497 across 55 suites; nonfatal WebSocket port-in-use warnings only.; npm run check-cli PASS; CLI bundle matches canonical sources.; guarana specs validate . --json PASS: 184 files, 67 feature specs, 30 ADRs, 207 links, 0 issues.; git diff --check PASS.; The confirmed status-inquiry bug is fixed for all three variants and is resolved by this overall proof.; Recorder cleanup remains as approved: no duplicate Deterministic .specs Record Command row; canonical Guarana spec record automation row retains VALIDATED / PASS 19/19. The 19/19 update and duplicate removal remain accepted changes.; The spec-record-command baseline receipt/tracker and pending cli/lib/spec-record.js and cli/commands/specs.test.js recorder source/test work are preserved; optional-currentStep compatibility was verified in this follow-up.; Only the project-local worker-specs profile was refreshed with approval; global profile and deployment were untouched. No commit, push, version, tag, publish, release, or shipping occurred.
Change: none
<!-- guarana:record:end -->
