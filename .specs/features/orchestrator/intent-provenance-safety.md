# Feature spec: Orchestrator intent and provenance safety follow-up

**Status: SHIPPED**

## Goal
Record the bounded orchestrator intent/provenance follow-up while preserving the parent feature status and project-shared workflow contract. The V2 setup adapter correction, regression, explicit plugin-adoption CLI, offline checks, and authorized live isolation gate are validated. The validated follow-up was pushed normally to origin/main as Git-only delivery; no npm publication, tag, or version change occurred.

## Requirements
- Portuguese informational requests remain read-only; explicit Portuguese and English mutations and guarana skill forcing retain their accepted behavior.
- Workflow goal and active-task values remain untrusted data, and workflow event provenance remains limited to source, sessionID, and agent.
- Project-shared workflow persistence and native Task worker identity remain intact.
- V2 setup wires the documented top-level ctx.session API into child metadata lookup, without depending on undocumented ctx.client; it recognizes direct matching SessionInfo with optional data-envelope/error fallback. V1 nested path/query and data decoding remain compatible.

## Assumptions and scope
- The accepted orchestrator intent, prompt-data trust, provenance, and native Task child-isolation follow-up.
- Earlier implementation, test, plugin-only deployment, and post-restart runtime evidence are historical and do not establish the current overall live-isolation criterion.
- Git-only delivery to origin/main was confirmed after validation; no npm publication, tag, or version change occurred.
- The accepted ADR-039 plugin-adoption slice is independently verified offline; its actual global adoption/install and live isolation gate are documented in the completed live-gate proof below.

## Acceptance criteria
1. Core, plugin, and CLI regressions verify Portuguese informational requests do not start tasks or bootstrap records, while explicit Portuguese and English mutation requests and guarana skill forcing remain valid.
2. Prompt and workflow-event regressions verify goal and active-task values remain untrusted, separate from authoritative rules, and event records contain only source, sessionID, and agent provenance.
3. Core and plugin regressions verify unfinished project-shared workflow state resumes across sessions and native Task worker identity remains intact.
4. V2 setup uses the documented plugin-context shape: the context API client exposes ctx.session.get({sessionID}); the adapter does not depend on ctx.client. It recognizes direct matching SessionInfo and retains the optional data-envelope/error fallback.
5. V1 nested path/query plus data decoding remains compatible.
6. The setup regression uses a context with top-level session.get and no client property. Its agentless child metadata lookup is asserted with the existing {sessionID, directory} argument object and preserves workflow bytes/state, prevents bootstrap and parent-workflow injection, and retains native Task worker identity. The completed live gate used one global adoption, one plugins-only install, one restart invocation, read-only post-restart checks, and exactly one read-only native worker-verify Task. The project workflow file was byte-identical immediately before and after that Task; no probe, retry, second Task, or second restart occurred.
7. The offline compatibility regression, full suite, CLI-sync check, diff check, and pre-record specs validation pass. These checks do not establish live deployment or runtime isolation by themselves; the completed live gate is recorded below.
8. The separate ADR-039 offline CLI-adoption slice satisfies its six independently verified criteria: exact syntax/allowlist and rejection cases; fail-closed preconditions and no-write rejections; single-entry hash-only success with byte/manifest preservation and ordinary-error rollback; isolated standard install without weakening strict install/uninstall preflight; CLI documentation/help; and independent focused/full/check/spec validation. The offline PASS is distinct from, and is supplemented by, the completed live-isolation proof below.

## Latest live Task-isolation recurrence (2026-10-23)

After a primary `workflow_tick` placed the run in coding, a native worker-code Task completed with no diff. The next primary `workflow_tick(code_complete)` returned exactly `illegal transition code_complete from planning`, with state `planning`. Sanitized telemetry showed `source=chat.message`, `agent=null`, `event=new_task`, `from=coding`, `to=planning`, `skill=plan`. After the primary forced debugging, a native worker-debug Task was followed by another sanitized event with `source=chat.message`, `agent=null`, `event=new_task`, `from=debugging`, `to=planning`, `skill=plan`. An earlier live verifier Task left workflow bytes unchanged, so outcomes are inconsistent and root cause remains unproven. No session IDs, prompts, or user content are recorded.

The then-current V2 setup regression exercised the metadata-only lookup path but mocked nested `client.session.get`; the later planning finding below establishes that this fixture did not model the documented plugin context.

## Authorized one-shot live diagnostic (2026-10-23)

After the user confirmed the server restart, exactly one native verification Task ran and emitted the single allowlisted probe token `lookup-unavailable`, meaning the live V2 hook could not access a callable `client.session.get` at lookup time. The one-shot marker was consumed. Workflow SHA-256 changed from pre-dispatch `acc6b6d991aa52690adca44e158157aa374ae3aa0810971492d9f56418fec0d5` to post-dispatch `d7b298d3fccad97ae027df66cc851fc468a2c4a4fe93a40a617da906dac8375c`, so child isolation failed. At the time of that diagnostic, the exact reason the hook context lacked the method was unproven; the planning finding below establishes the V2 adapter-contract mismatch. Prior stored session metadata established a child record, not method availability at hook time. Temporary diagnostic code was removed from canonical, CLI, and installed global orchestrator plugins, and temporary marker/result/baseline files were removed. No additional restart occurred; final canonical/CLI/installed plugin hashes match. Post-cleanup `npm run check-cli`, focused plugin tests (52/52), and `git diff --check` passed. The prior full suite (600/600) is historical and predates probe cleanup. GitHub push remains pending; this live-isolation result blocks validation, so the follow-up remains IMPLEMENTED and is not SHIPPED. No identifiers, prompts, or raw tool output are recorded.

## Confirmed V2 setup contract mismatch and planned acceptance (2026-10-23)

The official [OpenCode V2 plugin documentation](https://opencode.ai/v2/docs/build/plugins/) describes plugin context as the API client itself and exposes session operations directly as `ctx.session.get({sessionID})` (Sessions section / SessionContext reference). Current `setupGuaranaOrchestrator` passes `{ client: ctx.client }` into `GuaranaOrchestrator`, while the V2 setup regression's `mockContext` models nested `client.session.get` instead of documented top-level `ctx.session`. The authorized probe's `lookup-unavailable` specifically means `client?.session?.get` was not callable in the V2 prompt hook; together these facts confirm the adapter-contract mismatch at the V2 setup boundary. The correction and a fresh live check have not been performed. Do not repeat a live runtime attempt in this phase.

The bounded correction will wire the documented V2 `ctx.session` API into the existing metadata lookup without relying on `ctx.client`, and update the setup fixture to expose top-level `session.get` with no `client` property. Acceptance requires the agentless child lookup to be called with the existing supported `{sessionID, directory}` arguments and preserve workflow bytes/state, avoid bootstrap and parent-workflow injection, and retain native Task identity. Preserve V1 nested path/query plus `{data}` decoding, direct V2 `SessionInfo` plus envelope fallback, primary behavior, worker isolation, and project-shared workflow semantics. Keep the follow-up IMPLEMENTED until a fresh authorized live isolation check passes; no VALIDATED or SHIPPED claim applies.

## Offline correction milestone (2026-10-23)

The V2 setup now passes documented top-level `ctx.session` into the existing metadata lookup, and V2 calls `session.get({sessionID, directory})`. V1 retains `client.session.get` with nested path/query plus `{data}` decoding. The `plugin/plugin-v2-compat.test.mjs` mock context exposes top-level `session.get` and intentionally has no `client` property; the regression asserts the exact lookup arguments, direct matching `SessionInfo` and `{data}` child isolation, workflow-byte/state preservation, no bootstrap or parent-workflow injection, primary classification, and lookup-error fallback. Canonical and CLI plugin sources are byte-identical.

Post-fix checks: `npm test` passed 600/600; `npm run check-cli` passed; `git diff --check` passed. Specs validation passed before this record edit: 207 files, 80 features, 38 ADRs, 234 links, and 0 issues. No fresh native Task isolation check, install, deployment, or restart was performed because no fresh explicit authorization was given. The previous live probe still establishes the live isolation failure; this offline correction does not establish or resolve runtime deployment. The follow-up remains IMPLEMENTED, with the live check and GitHub push pending; no npm publish, tag, version change, or SHIPPED claim occurred.

## Authorized live-gate attempt and stop condition (2026-10-23)

The one authorized `node bin/guarana.js plugin install --plugins-only` attempt was refused before mutation with `refuse to install: managed plugin file was modified`. Read-only inspection confirmed that the managed global manifest's tracked orchestrator-plugin hash does not match the current installed file hash; the installed plugin is probe-free but stale relative to the corrected candidate, and status reports stale. Temporary probe code was removed from canonical and CLI sources; no marker/result artifact was created in the repository. No service restart or native verification Task ran, and no retry was attempted. A safe supported reconciliation path has not been established. This authorization is consumed; any further repair, install, restart, or Task requires fresh approval. The live isolation failure remains unresolved; keep this follow-up IMPLEMENTED, with live validation and GitHub push blocked/pending, not SHIPPED. No hashes, IDs, prompts, or raw output are recorded.

## Historical verification and deployment checkpoint (2026-10-23)

The earlier checkpoint remains historical: `npm test` passed 600/600 on Node v24.20.0; focused canonical/plugin tests passed 110/110; bundled CLI tests passed 58/58; V2 compatibility checks passed 7/7; `npm run check-cli`, `git diff --check`, and specs validation passed; package inventory contained 131 files with required documentation and no `node_modules`. The earlier live verifier Task was reported to leave project `.specs/state/workflow.json` byte-identical, and child regressions covered byte/state preservation, no bootstrap, and no parent-workflow injection. The earlier V2 direct-`SessionInfo`/optional-envelope and V1 compatibility checks remain recorded. Global plugin-only deployment, matching installed/canonical/CLI plugin hashes, up-to-date status, healthy engine, and user-supplied post-restart runtime evidence are also historical. None of these facts establishes that the current overall live-isolation criterion passes after the recurrence above. GitHub push remains pending; no npm publish, tag, or version action occurred.

## ADR-039 explicit plugin-adoption CLI (2026-10-23; offline implementation verified)

The accepted capability is offline for now and is limited to the known global orchestrator-plugin mismatch, with reusable one-plugin semantics. The exact command is `guarana plugin adopt <plugin-file> --accept-current [--project]`. It acts on exactly one of the three allowlisted Guarana plugin filenames in the selected scope; it never accepts arbitrary paths or bulk targets. `--accept-current` is mandatory and explicitly acknowledges the ownership transition.

Adoption requires a valid existing manifest with exactly one tracked entry for that plugin, an existing regular non-symlink target, a recognized plugin-specific Guarana marker, and current target bytes whose SHA-256 differs from the tracked hash. Success changes only that entry's SHA-256 in the selected install manifest. It must not write, replace, or delete plugin bytes, or change any other manifest group or entry. A single-target manifest transaction must roll back on ordinary filesystem errors.

Reject with no writes when acknowledgment is absent; the plugin is unknown; the manifest is absent, malformed, or lacks exactly one valid tracked entry for the plugin; the entry is duplicate, invalid, or already has the current hash; the target is missing, a symlink, or non-regular; or its plugin-specific marker is absent. Normal install/uninstall preflight remains unchanged and continues enforcing byte/hash ownership; after explicit adoption, a standard install can proceed through that unchanged guard. This is not a general force mechanism and does not implicitly adopt tracked changes.

The design followed the read-only audit: `cli/commands/plugin.js` `preflightPlugins` lines 54–76 rejects tracked-byte mismatch for install and uninstall, `--plugins-only` does not bypass it, and marker-based legacy adoption applies only to untracked files. Tests at `cli/commands/plugin.test.js:604-653` established refusal/no mutation for tracked mismatch and the untracked-only legacy path. The inspected global target is a regular tracked plugin with its expected plugin-specific marker, no temporary probe, and bytes stale versus the tracked hash. The offline command implementation and proof are recorded below; no actual adoption or other live recovery/installation has occurred. A fresh bounded authorization for the exact live sequence has since been granted, and none of its actions has occurred; see the current authorization record below. See [ADR-039](../../decisions/ADR-039-explicit-plugin-ownership-adoption.md).

### Independent offline implementation proof

Fresh independent `worker-verify` returned OVERALL PASS for all six ADR-039 CLI criteria. This verifies the implementation in isolated fixtures, not the actual global/project plugin state or runtime behavior:

1. `cli/commands/plugin.js:143–151` requires the exact two-argument form and one of three allowlisted plugin filenames. `cli/commands/plugin.test.js:728–736` covers missing acknowledgment, unknown names, extra/duplicate arguments, and argument order.
2. Preconditions are enforced at `plugin.js:153–175`, manifest validation at `cli/lib/engine-artifacts.js:74–97`, and tracked-entry uniqueness at `plugin.js:36–51`. Rejection tests `plugin.test.js:728–840` assert fixture bytes/tree remain unchanged.
3. Success changes only the selected hash (`plugin.js:177–179`). Tests `plugin.test.js:632–681` prove plugin bytes and other entries/groups remain unchanged; tests `plugin.test.js:843–879` inject a post-replacement ordinary failure and prove exact manifest/tree rollback.
4. The isolated standard install after adoption passes in tests `plugin.test.js:668–675`. Existing modified-plugin install/uninstall refusal tests `plugin.test.js:610–630` pass, and strict preflight `plugin.js:54–76` is unchanged.
5. The command and ownership semantics are documented in `README.md:187–216`, `cli/help.js:25–28`, and `cli/command-metadata.js:104`; `node bin/guarana.js --help` displays them.
6. Independent checks: `node --test cli/commands/plugin.test.js cli/main.test.js` PASS (58/58); `npm test` PASS (605/605); `npm run check-cli` PASS; `git diff --check` PASS; `node bin/guarana.js specs validate /home/arch/codes/Guarana --json` PASS before this record write (208 files, 80 features, 39 ADRs, 238 links, 0 issues). Worker-code focused plugin tests passed 28/28 as secondary evidence.

Implementation attribution is limited to `cli/commands/plugin.js`, `cli/commands/plugin.test.js`, `cli/help.js`, `cli/command-metadata.js`, `README.md`, and ADR-039; unrelated dirty orchestrator/spec paths are not attributed. No actual global/project adopt/install/uninstall, restart, or live Task has occurred in the newly authorized sequence. The global plugin remains stale. The bounded authorization below permits only its exact one-shot sequence; live isolation and conditional GitHub push remain pending. No commit, push, publish, tag, or version change has occurred. Overall follow-up remains IMPLEMENTED, not VALIDATED or SHIPPED.

Implementation acceptance requires CLI help and README documentation of the command and explicit ownership semantics; no-write tests for every rejection case; proof that success changes exactly one manifest-entry hash while plugin bytes and unrelated manifest data remain unchanged; rollback/no-partial-write proof; and an isolated fixture showing ordinary install proceeds afterward without weakening existing guard tests. Focused plugin/CLI tests, `npm test`, `npm run check-cli`, mirror parity, `git diff --check`, and specs validation must pass. These are pending gates, not completed proof. The feature remains IMPLEMENTED with live isolation unresolved. The newly granted scope authorizes only the exact one-shot sequence recorded below and commit/push of intended, reviewed candidate changes only if the live gate passes; no live action has occurred yet. No temporary probe, npm publish, tag, or version change is authorized.

## Fresh bounded authorization for live isolation gate (2026-10-23)

The user authorized this exact sequence, which has not yet been performed:

1. One global `node bin/guarana.js plugin adopt guarana-orchestrator.js --accept-current`.
2. If adoption succeeds, one global `node bin/guarana.js plugin install --plugins-only`.
3. One OpenCode service restart.
4. Then exactly one read-only native `worker-verify` Task comparing project `.specs/state/workflow.json` bytes/hash immediately before and after the Task.

If adoption or install fails, stop before restart/Task. No retries. Commit and push only intended, reviewed candidate changes, and only if the live isolation gate passes. No temporary probe, npm publish, tag, or version change. The offline adoption CLI is independently verified PASS (6/6); focused tests passed 58/58 and `npm test` passed 605/605; check-cli, diff-check, and specs validation passed. The global plugin remains stale and the last install was refused before mutation. No global adoption/install/restart/Task in this newly authorized sequence has occurred. Keep this follow-up IMPLEMENTED, not VALIDATED or SHIPPED until the live isolation gate passes. The parent orchestrator status and Portuguese classifier resolution remain unchanged.

## Completed live-gate validation (2026-10-23)

Fresh user authorization was followed exactly once. `node bin/guarana.js plugin adopt guarana-orchestrator.js --accept-current` succeeded globally; immediate assertions proved the installed plugin bytes were unchanged and only its selected manifest hash changed. Read-only install preflight passed for exactly 3 plugins and 3 engines with 0 profile writes. The single `node bin/guarana.js plugin install --plugins-only` succeeded. All three global plugins byte-match current bundles; plugin status reports all current and engines deployed/healthy; the deterministic worker/advisor profile snapshot equals the pre-install baseline.

Exactly one `opencode service restart` invocation was issued. That tool call was interrupted, then the user confirmed the server restarted; no command-success claim is made. Post-restart read-only `opencode service status` and `/api/info` succeeded. Location-scoped `/api/plugin` showed `guarana.orchestrator` active from the global plugin path.

Exactly one live native read-only `worker-verify` Task ran and reported the global orchestrator up-to-date/deployed. Primary SHA-256 comparison immediately before and after the Task established that project `.specs/state/workflow.json` was byte-identical. No probe, retry, second Task, or second restart occurred.

Independent offline proof also passed: adoption CLI overall PASS (6/6); `node --test cli/commands/plugin.test.js cli/main.test.js` PASS (58/58); `npm test` PASS (605/605); check-cli and diff-check PASS; specs validation PASS (208 files, 80 features, 39 ADRs, 238 links, 0 issues). Together the offline and live evidence validate this bounded follow-up. The validated follow-up was pushed normally to origin/main, and a read-only remote-ref check confirmed the pushed ref matched. No force push, npm release/publication, tag, or version change occurred; delivery is Git-only. The parent orchestrator overall status and Portuguese classifier resolution are unchanged.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: The live gate passed exactly as recorded in the current feature and change records.; The validated follow-up was pushed normally to origin/main; read-only git ls-remote origin refs/heads/main confirmed the remote ref matched the pushed commit.; No force push, npm release/publication, tag, or version change occurred.; cli/main.test.js remains a pre-existing unrelated, uncommitted unstaged change and is not attributed to this follow-up.
Change: .specs/changes/2026-10-23-orchestrator-intent-provenance-safety.md
<!-- guarana:record:end -->
