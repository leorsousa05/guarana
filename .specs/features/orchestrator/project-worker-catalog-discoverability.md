# Feature spec: Guarana worker catalog discoverability

**Status: VALIDATED**

## Goal
Make worker-code, worker-verify, worker-debug, and worker-specs discoverable as OpenCode subagents in both project and global sessions, with the behavior persisted by the tracked profile generator. Keep guarana-advisor hidden and unchanged.

## Requirements
- OpenCode V2 removes agents with `hidden: true` from the subagent catalog.
- The project- and global-scope worker-code, worker-debug, worker-specs, and worker-verify profiles are visible subagents after refresh and reload.
- The tracked profile generator produces `hidden: false` for all four workers in both scopes; CLI tests cover both generation modes and confirm refresh/status consistency.
- Refresh managed profiles in both scopes without changing `guarana-advisor` or overwriting foreign profile content.
- Preserve unrelated checkout changes; this worker-catalog feature does not include release or shipping.
- Do not force-add ignored project/global configuration profiles. Preserve all existing checkout changes and unrelated content.

## Assumptions and scope
- The user's explicit approval supersedes the earlier project-only visibility decision: all four workers are to be visible in both project and global profiles; `guarana-advisor` remains hidden and unchanged.
- `cli/lib/agents.js` and its CLI tests are the durable implementation scope. Managed project and global profiles are to be refreshed, then OpenCode reloaded and the effective catalog checked read-only.
- Handoff baseline: project worker-code, worker-debug, and worker-verify profiles are current; project worker-specs is stale/foreign. All four global profiles are hidden; global worker-specs is stale/foreign. Resolve ownership before any refresh that could overwrite foreign content.
- Ignored project/global configuration profiles must not be force-added. The one-time global visibility-only profile merge and its independent byte/mode verification are complete as recorded below. Authenticated effective catalog verification for both project and global-only scopes is PASS as recorded below. Full-checkout review and any release push are tracked separately in `.specs/features/release/release-candidate-push.md` and are not acceptance criteria for this feature.

## Acceptance criteria
1. Generator output and CLI tests establish `hidden: false` for worker-code, worker-verify, worker-debug, and worker-specs in both project and global profiles.
2. Managed profiles are refreshed in both scopes without modifying `guarana-advisor`; its existing hidden profile remains unchanged. Foreign worker-specs content is not overwritten without established ownership.
3. After OpenCode reload, read-only effective catalog inspection confirms all four workers are available as subagents with `hidden: false` in project and global sessions.
4. CLI tests cover both generation modes and confirm install/refresh/status consistency with generated visibility.
5. Any worker dispatch evidence is scoped to the specific profile/session tested; the existing project Task worker-specs dispatch does not substitute for both-scope catalog verification.

## Historical and superseded context
- The earlier project-only visibility decision and its project-only acceptance criteria are superseded by the explicit project-and-global approval.
- Historical evidence: a project Task worker-specs dispatch completed. It demonstrates project Task invocation only; it does not establish all-four visibility in both scopes, global worker-specs freshness, post-reload catalog behavior, full verification, or shipping. It is not current proof for the expanded acceptance criteria.
- Handoff diagnostic baseline: the project worker-code, worker-debug, and worker-verify profiles are current; project worker-specs is stale/foreign. All four global worker profiles are hidden; global worker-specs is stale/foreign. These are starting facts, not post-refresh verification results.
- Earlier independent worker-verify PASS (4/4) covered generator output with `hidden: false`, relevant CLI tests passing 45/45, Advisor remaining hidden, worker-specs profiles remaining untouched, and a disposable inline-config override returning probe `hidden: false`. That evidence did not establish persistent JSON-versus-Markdown precedence or visibility in the actual user catalog; the new precedence result below supersedes only the earlier “unknown” inference.

## Global visibility status

A disposable OpenCode 2.0.32 test was successfully readiness-polled. With global `opencode.json` setting `agents.worker-probe.hidden: false` and global `agents/worker-probe.md` setting `hidden: true`, `/api/agent` returned the probe with `hidden: true`. The later-loaded global Markdown profile therefore takes precedence over persistent global JSON configuration. The earlier inline `OPENCODE_CONFIG_CONTENT` override returned `hidden: false`, but is not persistent. The earlier persistent-config attempt that timed out before readiness did not establish precedence; this later result supersedes its “unknown” conclusion. This is isolated disposable evidence, not verification of the current user config or catalog.

**Superseded planning note (historical):** The user had authorized global visibility for the four Guarana workers and chosen “preserve and merge” for customized profiles. At that planning point, the proposed safe bounded merge had not yet been performed: back up exactly the four existing global Guarana worker profile files; change only each single frontmatter `hidden: true` line to `hidden: false`; preserve every other byte, including global worker-specs profile-specific permissions and body. Do not edit `guarana-advisor`, manifests, project profiles, generator, or permissions. Compare only those four exact line changes against the backups, reload and wait for `opencode.config.agent` readiness, then require actual `/api/agent` to show all four workers visible and Advisor hidden and unchanged. If the precondition fails, restore the backups and stop. This plan is superseded by the completed merge below.

**Superseded pre-SDK status (historical):** The initial empty-catalog API result left effective catalog verification unverified at that time; this point-in-time result is superseded by the independent PASS below.

**Historical repository-catalog proof (status at that milestone; superseded by the validated receipt below):** Worker-code performed the user-approved one-time visibility-only merge in all four global worker profiles. Only the frontmatter hidden line changed. Exact backups are retained as an external/ephemeral artifact named `worker-visibility-merge-meA6fS`, and independent byte/mode verification passed. Independent `worker-verify` PASSed authenticated effective catalog verification for `$REPO_ROOT` using one `@opencode/client@2.0.32` endpoint with `Service.ensure()` and `Service.headers(endpoint)`. On that endpoint, `opencode.config.agent` readiness passed on poll 1, the requested repository location matched, and the effective catalog showed worker-code, worker-verify, worker-debug, and worker-specs each `mode:subagent` and `hidden:false`, with Advisor `hidden:true`. At that milestone, this repository-location catalog proof did not establish global-only visibility, so the feature remained TASKED pending the remaining acceptance criteria. The fresh project/global evidence now recorded below supersedes that point-in-time status. Full-checkout review and release commit/push remain separate and pending; no shipping is claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS: cli/lib/agents.js generates hidden:false regardless of scope; node --test cli/lib/agents.test.js cli/lib/advisor.test.js cli/commands/plugin.test.js passed 45/45; Advisor generation remains hidden and project/global assertions pass; worker permissions and ownership guards remain.; Runtime worker-code SDK check in the current repository passed with exact @opencode/client@2.0.32, Service.ensure() and Service.headers(endpoint), authenticated info, opencode.config.agent readiness on poll 1, matching repository location, all four workers visible as subagents, and Advisor hidden. No repository, live profile, configuration, or manifest changes were made.; Fresh independent worker-verify confirmed the same live current-repository catalog: all four workers visible as subagents and Advisor hidden.; Fresh independent worker-verify confirmed global-only scope from a temporary location with no Git repository, project configuration, or agents: authenticated SDK info PASS, plugin readiness poll 4, matching temporary location, worker-code/worker-verify/worker-debug/worker-specs all mode:subagent and hidden:false, Advisor absent. Temporary install, project, and script were cleaned.; Global profile preservation was checked against the retained exact backup: only the approved hidden:true to hidden:false line differs for each of the four workers; modes and manifests are unchanged; customized worker-specs body and permissions are preserved. CLI status intentionally continues to report customized worker-specs as stale/foreign. No guarana update or forced manifest adoption occurred.; Specs validator PASS: 184 files, 0 issues.
Change: none
<!-- guarana:record:end -->
