# Feature spec: Guarana 1.4.0 known-issue status release

**Status: TASKED**

## Smoke-test policy supersession

ADR-036 retires all Guarana package/release/OpenCode-host smoke tests. Future
smoke execution or reintroduction as a development, CI, or release gate is
prohibited. This supersedes only the future-facing smoke requirements in this
record, including packed CLI lifecycle/dashboard startup, latest-stable host
smoke, and the manual workflow/task/persistence smoke checklist. Historical
authorizations, results, transcripts, and receipts below remain unchanged and
are historical evidence, not future requirements. This policy change does not
pass any release criterion, change this record's TASKED status, or authorize a
release operation; `.specs/state/known-issues.md` remains untouched. The active
release gates are the seven ordinary commands in root `RELEASING.md` plus
`npm pack --dry-run --json` package-content inventory inspection. Inventory
inspection is not a smoke test and does not install or execute the tarball. No
host-smoke version/result or manual workflow checklist is a release gate.

## Goal
Prepare and, only after every release gate passes, ship the independently validated known-issue status recorder as Guarana 1.4.0.

## Requirements
- Use 1.4.0 as the reversible release-candidate target, applying ADR-007's feature-sized minor-version default without skipping any release gate.
- The known-issue status recorder is independently validated PASS (9/9) and remains VALIDATED during candidate preparation; preserve .specs/state/known-issues.md unchanged.
- Follow root RELEASING.md's seven ordinary release checks and inspect package contents with `npm pack --dry-run --json`; do not install or execute the tarball. ADR-036 prohibits all package/release/OpenCode-host smoke tests.
- The user's explicit 'Pode dar ship' authorizes the full release sequence only after its gates pass. This record-only dispatch performs no release action.
- Include every modified and untracked working-tree change present when the release candidate is assembled; do not add anything not actually present in the current worktree. Do not force-push, expose secrets or credentials, or claim publication or SHIPPED without evidence.

## Assumptions and scope
- The candidate starts from root package and README version 1.3.1; CHANGELOG describes an unpublished candidate; npm latest is 0.0.3 and guarana@1.3.1 is absent; no local or remote Git tags were returned.
- The current branch is main at HEAD 37d9c1e; all current working-tree changes are uncommitted, and no remote operation has occurred. The authorized release scope includes every modified and untracked change actually present in the worktree, with nothing added from outside it.
- ADR-036 retires all package/release/OpenCode-host smoke. Root RELEASING.md lists seven ordinary release commands and a separate `npm pack --dry-run --json` package inventory check; the inventory is not a smoke test and the tarball must not be installed or executed.
- No new ADR is needed; use existing ADR-007 and RELEASING.md.
- Prepare consistent 1.4.0 package metadata, README badge/status, and dated CHANGELOG release notes containing only the supplied validated capability while retaining [Unreleased].
- Pass the seven ordinary release commands in root RELEASING.md on the clean candidate and inspect `npm pack --dry-run --json` for required package contents and absence of `node_modules` paths; do not install or execute the tarball. Obtain fresh independent release verification. No package, host, or manual-workflow smoke is to be run or used as a gate.
- After the ordinary checks, package inventory, and independent verification pass, commit and push normally to origin/main and verify the exact remote SHA. Then publish guarana@1.4.0, create v1.4.0, and verify the registry version and remote tag.
- Record actual release evidence and update release/feature/tracker/change statuses only when warranted; keep known-issues.md unchanged.

## Acceptance criteria
1. The local candidate package version, README badge/status, and dated CHANGELOG release heading consistently identify 1.4.0 and include only supplied validated feature facts; [Unreleased] remains present.
2. On the clean candidate, all seven ordinary commands in root RELEASING.md pass: `npm ci --prefix dashboard`; `npm ci --prefix dashboard/server`; `npm run audit`; `npm test`; `npm run build`; `npm run check-cli`; and `npm run specs:validate`. `npm pack --dry-run --json` inventory inspection confirms `LICENSE`, `CHANGELOG.md`, and `RELEASING.md` are included and no `node_modules` paths are present; the tarball is not installed or executed.
3. The candidate includes every modified and untracked working-tree change present when it is assembled and contains no change sourced from outside that worktree. Per ADR-036, no package/release/OpenCode-host smoke test is run or reintroduced; no host-smoke version/result or manual workflow/task/persistence checklist is a release criterion.
4. A fresh independent worker-verify passes the candidate release criteria, and `.specs/state/known-issues.md` is unchanged.
5. After criteria 1–4 pass, commit and ordinary push to origin/main succeed with no force push, and a read-only remote check confirms the exact intended commit SHA.
6. Only after criteria 1–5 pass, publish `guarana@1.4.0` and create matching tag `v1.4.0`; verify the exact npm registry version and remote tag resolve to the release.
7. Update release/feature/tracker/change records to SHIPPED only after public npm publication and matching remote tag are confirmed. Otherwise preserve the actual VALIDATED/TASKED state and exact blocker; no SHIPPED status precedes publication and tag confirmation.

<!-- guarana:record:start -->
Status: TASKED
Proof: Prior managed Proof field was overwritten to none by an earlier recorder update; the exact current-source pre-update receipt was not recoverable. The sole located copy was a stale candidate still requiring retired smoke and was not substituted or reconstructed.; On candidate /home/arch/.local/share/opencode/worktree/4e62b0/guarana-1.4.0-release-candidate, Node v24.20.0/npm 12.2.0: npm ci --prefix dashboard PASS (0 vulnerabilities; esbuild@0.25.12 install script blocked by npm allowScripts warning); npm ci --prefix dashboard/server PASS (0 vulnerabilities); npm run audit PASS (0 vulnerabilities in both workspaces); npm test PASS (567/567); npm run build PASS; npm run check-cli PASS; npm run specs:validate PASS (197 Markdown, 73 features, 36 ADRs, 215 links, zero issues).; npm pack --dry-run --json PASS as inventory only: guarana@1.4.0, guarana-1.4.0.tgz, 131 files, required LICENSE/CHANGELOG.md/RELEASING.md included, zero node_modules paths; corrected static parser passed npm 12's JSON object wrapper. Tarball not installed or executed; no smoke test ran. Evidence directory: /tmp/opencode/guarana-1.4.0-final-gates-20261022T142546. No commit, push, tag, publish, release action, or known-issues change occurred.; Fresh worker-verify returned overall PASS for criteria 1–5 on exact candidate /home/arch/.local/share/opencode/worktree/4e62b0/guarana-1.4.0-release-candidate. Criterion 1 PASS: package 1.4.0, README badge/status, CHANGELOG.md:94–106 heading ## [1.4.0] - 2026-10-22 without unpublished qualifier, recorder and smoke-retirement notes, [Unreleased], and no false publication/tag claim.; Criterion 2 PASS: smoke script/package script/CI invocation absent; normal Node 22/24 CI gates retained; RELEASING.md states explicit MUST NOT and inventory-only language; active release spec smoke gates are superseded while historical receipts remain historical.; Criterion 3 PASS: current release criteria contain no host/manual smoke; proof loss and fresh-gate authorization are transparent; known-issue status recorder independently VALIDATED 9/9; .specs/state/known-issues.md unchanged with candidate/source SHA-256 both b0358fea7c214c49f9920aef37cfe88932c0ed078a6bc9267041f0c739fc7777.; Criterion 4 PASS: exact candidate scope matched; tracked patch hash equals source worktree and six untracked .specs records match by path and hash. Logs are in /tmp/opencode/guarana-1.4.0-final-gates-20261022T142546/. Node 24.20.0/npm 12.2 gates and package inventory PASS; candidate diff-check and post-sync specs validation PASS. Dashboard npm ci emitted an esbuild allowScripts blocked warning without failure.; Criterion 5 PASS: no smoke or release action occurred; candidate remains uncommitted; no SHIPPED claim. Node 22/24 CI remains pending after push. Verifier only read candidate/repository and ran no tests, build, pack, install, or release action.
Change: none
<!-- guarana:record:end -->

## No-model configuration-source diagnostic — 2026-10-20

Release remains TASKED. Evidence: `/tmp/opencode/no-model-source-evidence.CoLac4/config-source-diagnostic.json` on OpenCode v2.0.32. A fresh `XDG_CONFIG_HOME` and matching `OPENCODE_CONFIG_DIR` resolved the CLI config path under the fresh root, while `debug config` showed `/home/arch/.config/opencode/opencode.jsonc` (document), `/home/arch/.config/opencode` (directory), and candidate `.opencode`. Candidate hash/install succeeded. Independent `worker-verify` confirmed these are artifact assertions only. No model/API call, credentials, or cleanup occurred.

Version-matched source at commit `843a6c514e606b436a7fe713422ace0a93ad3d61` shows `debug paths config` reports the invoking CLI config root, while `debug config` queries a background server; server registration is under XDG state and a healthy server may be reused. Host server reuse is the likely explanation, not proven because the artifact omitted environment-presence and service startup/reuse facts. Config and data roots are separate; preserve `XDG_DATA_HOME` to reuse auth/data without copying credentials. Do not rely on `XDG_CONFIG_HOME` alone.

Next controlled no-model hypothesis: use fresh `XDG_CONFIG_HOME`, matching `OPENCODE_CONFIG_DIR`, and fresh `XDG_STATE_HOME` to avoid host server registration reuse; leave `XDG_DATA_HOME` untouched. Capture environment-presence and startup/reuse evidence, then sanitized source paths before runtime/model. Hard stop if provenance is unclear. `.specs/state/known-issues.md` remains unchanged. No product failure, VALIDATED/SHIPPED status, publish, tag, or commit is claimed.

## Source-classification resolution goal and permission blocker

Goal: resolve the source-classification gate with version-correct, fail-closed behavior and independent verification, not merely a hypothesis or report. Release remains TASKED; the earlier controlled hypothesis is not permission to retrieve raw configuration.

Completed read-only worker-debug and independent worker-verify establish the exact-version contract for OpenCode v2.0.32, commit `843a6c514e606b436a7fe713422ace0a93ad3d61`: `packages/protocol/src/groups/config.ts:9–20` returns a root array of `Config.Entry`; `config.ts:121–134` documents optional document path with required info and required directory path. `server handlers/config.ts:7–9` returns entries directly, without metadata projection. No config-provenance-only endpoint was found in the inspected exact-version protocol; `location.ts:6–12` supplies no projection switch. The original helper was unavailable within the permitted script-source search, so parser mismatch remains unproven.

Evidence limits: `/tmp/opencode/guarana-1.4.0-candidate-20261020.P8Kl6W-run.Fq10hV-evidence/smoke-evidence.json` proves only reported empty summaries, a false gate, and safe-stop. The separate `/tmp/opencode/no-model-source-evidence.CoLac4/config-source-diagnostic.json` reports residual host globals but does not attribute the original failure. Neither establishes actual candidate provenance; synthetic tests cannot establish it either.

Permission blocker: live `/api/config` retrieval includes document info before client-side discarding, while current user constraints prohibit raw-config inspection. Before live provenance proof, obtain explicit approval for a bounded, audited in-memory projection with no raw response or logs retained or exposed, or an approved server-side metadata-only change. Synthetic tests alone cannot clear this live blocker.

Resolution acceptance:
- Independently verify source classification against the pinned root-array contract, including optional document path and required directory path, with unknown or disallowed provenance failing closed.
- Obtain the explicit projection approval or approved server-side metadata-only change before collecting live evidence; record actual candidate provenance separately from synthetic test outcomes.
- Pass provenance, OAuth, model, and local-tool gates before any future smoke model call; then obtain independent verification of the live gate result. Until then, preserve the exact blocker and leave model/persistence smoke incomplete.
- Preserve existing artifacts and user authentication/data, keep `.specs/state/known-issues.md` byte-for-byte unchanged, and make no commit, publication, tag, or SHIPPED claim in this bounded update. Smoke model calls remain zero.

Next: request the bounded projection authorization or approved metadata-only alternative, then pursue and independently verify the version-correct live resolution. This record does not authorize raw-config inspection or assert that the blocker is resolved.

## Approved bounded provenance projection

The user explicitly approved an independently audited helper receiving `/api/config` in memory only and projecting type/path/classification. This supersedes the pending-authorization requirement above only for this bounded scope: no raw response persisted or exposed, no credential-file access, no user authentication/data changes, and no smoke model call. Approval does not establish a passing source gate.

Plan: create the new temporary helper and tests under a unique `/tmp/opencode` directory, preserving all existing artifacts and candidate files. Obtain offline independent safety/regression review first, then run one controlled no-model candidate provenance probe with fully disposable HOME/config/state/data/cache. Never copy user credentials or touch the user's authentication/data store. The isolated probe can establish only clean-candidate configuration sources, not OAuth availability or the original failed-run cause.

Acceptance for this bounded probe:
- Parse the pinned root-array contract correctly; distinguish missing, empty, unknown, and disallowed sources and fail closed for each.
- Check canonical source containment and symlinks before accepting source paths.
- Sanitized evidence excludes document info, configuration values, authentication material, passwords, and raw errors; no raw response is retained or exposed.
- Record owned loopback-server version, PID, and location proof, and prove that the owned process was stopped.
- Obtain independent verification of the sanitized result before claiming the source gate cleared. If live evidence reveals disallowed sources, stop before any model call and correct only temporary isolation within approved roots.

Release remains TASKED. OAuth, model, local-tool, and persistence gates remain incomplete. This approval authorizes neither release actions nor changes to known-issues, tracker, workflow, existing artifacts, candidate files, or user data/authentication. Next: implement the temporary helper/tests and obtain the offline independent safety/regression review before the controlled live probe.

## Runner safety correction before live execution

Independent runner safety audit: FAIL before any live probe. Fresh environment roots alone do not prevent ancestor/system configuration discovery; a listening socket also precedes API readiness, so `/api/info` can return 503. Offline classifier checks independently passed 64 tests and runner checks passed 25, but neither result grants live approval.

The primary selected enforced filesystem isolation using existing `bwrap`; a harmless isolated `/bin/true` capability test passed. Expose only the fresh execution root and read-only runtime binaries/libraries, not host configuration, data, authentication, or user homes. No service daemon, global profile, or system file is edited. This replaces reliance on fresh environment roots alone.

Before location/config requests, poll the existing authenticated `/api/info` endpoint for readiness, retrying only startup 503/transport failures, at most 30 attempts within a deadline. Add no endpoints or model calls. Prove sandbox child ownership through wrapper-spawn lineage/PID if the wrapper forks, exact server PID/version, and sockets; deterministically clean up only owned processes.

Condition tests and independent safety PASS must precede the single live probe; independent artifact and execution review must follow it. Release remains TASKED and known-issues remains untouched. No original-cause, OAuth, runtime, model, or persistence success is established by these offline results or the isolation choice.

## Single isolated attempt and installation blocker

Corrected helper `/tmp/opencode/source-probe-isolated.odRTOQV0` received independent safety PASS (43 runner tests and 64 classifier tests), authorizing one live attempt. It ran exactly once, unchanged, and exited 1. Sanitized artifact `/tmp/opencode/source-probe-execution.R4r78c/evidence.json` reports install stage/error, hash match true, install false, project/server/source not checked, stopped true, model count 0, isolated fresh data, no credentials, and cleanup false. The primary read only this sanitized artifact; source provenance remains unresolved.

Read-only worker-debug examination of npm `@npmcli/config` establishes deterministic duplicate-source rejection if configuration loads with both `NPM_CONFIG_USERCONFIG` and `NPM_CONFIG_GLOBALCONFIG` set to `/dev/null`. The collapsed evidence does not confirm that this was the failed attempt's branch; retain it as a conditional explanation, not the original cause.

Next hypothesis: create a new helper revision with distinct empty, exclusively created mode-0600 npmrc files inside the fresh root, plus an offline npm preflight in the same sandbox. Emit only bounded enum and numeric-exit diagnostics, never persisted raw text. Independently audit the new helper before another single fresh live probe. Preserve the previous helper and evidence.

Release remains TASKED; the source gate is not resolved. No publication, tag, commit, or model smoke occurred. OAuth, runtime, model, and persistence remain unverified; known-issues is untouched.

## Accepted completion — clean isolated candidate configuration-source gate

The primary accepted the narrow clean isolated candidate configuration-source gate as resolved by a successful new probe. This supersedes the unresolved isolated-source status and next-attempt instructions above, not their historical evidence. Release remains TASKED; this is neither overall feature validation nor full-smoke completion.

Helper `/tmp/opencode/source-probe-npmfix.xFU66bBP` received independent safety PASS (47 tests plus repeated bootstrap passes); classifier `/tmp/opencode/source-projection-offline.I1aFuIFq/projection.mjs` independently passed 64 tests. One fresh approved probe, `node /tmp/opencode/source-probe-npmfix.xFU66bBP/runner.mjs --execute-live-once`, exited 0. This is an immutable-run handoff only, not historical attestation. Independent worker-verify PASS covers code, artifact, and metadata review, not independently witnessed execution of the underlying original commands.

Artifact `/tmp/opencode/source-probe-execution.cPT2C8/evidence.json` was independently checked as a regular nonsymlink file, mode 0600, size 1395, under a mode-0700 root, with the exact bounded allowlisted schema. It reports source outcome `pass`, reason `allowed-sources`, and two canonical directory sources:
- `/tmp/opencode/source-probe-execution.cPT2C8/config/opencode` — `isolated-global-directory`.
- `/tmp/opencode/source-probe-execution.cPT2C8/candidate/.opencode` — `project-config-directory`.

All artifact hash/install/project/preflight/cache/isolation/native-PID/version (2.0.32)/loopback/candidate-location/stopped flags are true. Independent archive SHA-256 recomputation returned `9b73d38e2c25bef669f0ef9a1156612adc08f214606eb87ac5a664e4bd2293fa`. A process-cwd metadata scan found zero currently observable processes under the fresh root; this is not universal descendant-cleanup proof. `bwrap` enforced the configuration filesystem boundary without user-store mounts; network and proc were shared, so this was not an adversarial sandbox.

The artifact reports model count 0, no credential-file access or copying, isolated fresh data, and cleanup false. OAuth, runtime, model, and persistence were not checked. Existing artifacts were preserved. Distinct fresh npmrc files and sandbox offline-cache preflight fixed a concrete helper defect; neither this success nor that correction proves the original installation-stop cause or the original empty-summary run's cause or provenance.

Next: continue only separately scoped, safely proven remaining smoke gates. This isolated source gate is no longer blocked, but its result alone authorizes no follow-on model execution; all remaining source, OAuth, model, local-tool, and persistence gates still apply. Do not copy credentials or commit, publish, tag, or claim SHIPPED. Known-issues remains untouched; completion is confined to the clean isolated candidate configuration-source gate.

## Authorized runtime and OAuth metadata preflight

The user authorized continuing a fresh isolated candidate-local runtime inventory and safe OAuth metadata preflight, including an audited helper that receives API responses only in memory. This is permission and acceptance scope only: no helper audit, API request, server execution, or new live result is claimed here. The earlier configuration-source result remains a narrow completed gate; release remains TASKED.

### Scope and boundaries

- Use only a fresh isolated candidate; do not use host authentication/data or alter existing artifacts. Preserve all existing artifacts and user data/authentication.
- The helper may receive allowlisted API responses in memory and project only the authorized project ID, type, path, and status metadata, plus the OpenAI integration OAuth method and whether a connection exists or has `needs_auth` state.
- Never expose or persist skill contents, agent prompts, MCP errors, credentials, or raw API responses.
- The exact OpenCode v2.0.32 endpoint allowlist is `GET /api/info`, `/api/location`, `/api/config`, `/api/plugin`, `/api/skill`, `/api/agent`, `/api/mcp`, and `/api/integration/openai`. Do not call `/api/credential`, auth/connect, tools, model, or generation endpoints.
- Before server launch, preflight candidate/global configuration files for any MCP-capable configuration and retain only permitted source/runtime metadata.
- If OAuth is absent, `needs_auth`, or uncertain, stop without model or credential-endpoint access and ask the user before any new OAuth grant.
- No commit, publication, tag, or SHIPPED claim is authorized by this metadata preflight. Keep `.specs/state/known-issues.md` unchanged.

### Acceptance criteria

1. After a changed-hypothesis temporary helper revision, synthetic tests and a fresh independent safety audit must pass before exactly one additional fresh isolated no-model probe; no further attempt is authorized by this acceptance.
2. Candidate runtime metadata shows exactly the active Guarana plugin IDs `guarana.telemetry`, `guarana.memory`, and `guarana.orchestrator`; all eight Guarana skill IDs at candidate paths; and `worker-code`, `worker-verify`, `worker-debug`, and `worker-specs` with candidate files.
3. The inventory reports zero MCP servers and no unexpected local plugin, skill, or agent origins.
4. The OpenAI integration projection contains only OAuth method and whether a connection exists or the `needs_auth` enum; no credentials or raw response are exposed or persisted.
5. Pre-launch configuration preflight identifies no candidate/global configuration files capable of configuring MCP and retains only permitted source/runtime metadata.
6. Absent, `needs_auth`, or uncertain OAuth state stops execution without model/credential-endpoint access; any new OAuth grant requires separate user authorization.
7. Existing artifacts and host authentication/data remain unchanged; the narrow source-gate result is not promoted to overall release validation, and known-issues remains untouched.

## Authorized changed-hypothesis plugin inventory retry

The prior acceptance permitted at most one fresh isolated no-model probe. That single attempt ran at `/tmp/opencode/source-probe-execution.iKodTo/evidence.json` and exited 1 at plugin inventory. Its sanitized reason `missing-id` is ambiguous between a non-string optional ID on a builtin/SDK entry and a missing expected Guarana plugin; the exact raw value and cause are unproven. The artifact reports source/install/location/configuration-preflight/isolation pass and server stopped; later inventory and OAuth were not checked; model calls were 0; credential-file access/copy were false; cleanup was false.

The user now authorizes exactly one additional changed-hypothesis fresh isolated no-model attempt, only after a temporary helper change, synthetic tests, and a fresh independent safety audit. The planned projector mitigation is not implemented or verified: allow `id: null` as absent only for non-target `builtin`/`sdk` plugin entries; distinguish fixed safe failure reasons; keep the three required Guarana entries strict on exact local IDs, canonical paths, and active status; reject other non-string IDs and unexpected local/package sources.

Never inspect, expose, or persist raw runtime responses, skill contents, prompts, errors, configuration, or credentials. Do not access, copy, or mount user authentication/data; do not call `/api/credential`, OAuth connect/grant, or model endpoints; preserve artifacts. This authorization does not claim a cause, pass, or second attempt, and authorizes no code/workflow JSON edits, commit, publish, tag, or SHIPPED status. Keep `.specs/state/known-issues.md` byte-for-byte unchanged; release remains TASKED. No ADR is warranted for this tactical, reversible helper behavior.

## Authorized bounded plugin activation readiness correction

The prior three attempts are consumed. The user explicitly authorizes exactly one further isolated no-model attempt, including temporary correction, deterministic testing, and independent audit beforehand; this is not authorization for unlimited live attempts. This supersedes the previous no-further-attempt hold only within the following scope. No implementation or new execution result is claimed.

Worker-debug identified a static helper readiness defect: `/api/info` establishes server identity only. In pinned OpenCode v2.0.32, `/api/plugin` can return initial `[]` without `awaitActivation`, while supervisor initial activation is forked. This makes a readiness explanation plausible, not proven: the prior sanitized all-false diagnostics do not prove a raw empty response or establish the earlier cause.

Acceptance for the new immutable temporary helper:
- Retry only structurally valid, candidate-matching empty plugin data arrays. Bound polling to a 10-second deadline, 200ms polling, and at most 50 requests; each request and wait must respect the remaining and overall deadlines.
- Preserve ownership checks. Project any nonempty list immediately using the unchanged strict ID, canonical candidate-local path, and active-state checks. Rejection, malformed data, or errors fail immediately without retry.
- Pass offline deterministic regressions and obtain a fresh independent safety PASS before exactly one new live run. Preserve earlier helpers and evidence.
- Keep the exact eight GET endpoint allowlist above unchanged. Never retain or expose raw responses, logs, configuration, credentials, or prompts; never access or alter user authentication/data, call credential/OAuth/model endpoints, perform cleanup, or take release actions.
- Release remains TASKED; the existing narrow source result does not prove remaining runtime, OAuth, local-tool, model, or persistence gates. Keep known-issues unchanged. No ADR or product issue is established by this helper defect or hypothesis.

## Fourth no-model attempt and offline skill-inventory correction

The fourth authorized no-model run used `readiness.yXo9Sz` and exited 1. Supplied evidence: `/tmp/opencode/source-probe-execution.ouiBGT/evidence.json`. The reported plugin gate now passes, as do source/configuration and preceding gates; skills stop at `unknown-skill`. Agents, MCP, integration, and OAuth remain unchecked. Reported model calls are 0, server stopped is true, and credential access is false. Independent artifact verification has not yet occurred; these are reported results, not an independent release PASS.

Static worker-debug findings establish that the installer recursively copies the entire skill tree. The pinned archive lists ten `SKILL.md` paths (root plus nine nested, including specs), while the temporary helper's `EXPECTED_SKILLS` incorrectly lists eight and omits specs. The pinned loader derives immediate-parent ID `specs` and display name `guarana:specs`. The raw rejected runtime item remains unknown; these static findings do not prove the runtime rejection's cause.

New acceptance is OFFLINE only:
- Include exact skill ID `specs`, display name `guarana:specs`, and canonical candidate-local path `.opencode/skills/guarana/skills/specs/SKILL.md` in the inventory contract.
- Use hardcoded independent nine-skill fixtures, not fixtures generated solely from the allowlist. Regressions must cover missing, duplicate, wrong, symlink, and sentinel cases.
- Preserve all existing safety constraints and tests, including the endpoint allowlist, credential/OAuth/model prohibitions, ownership and isolation checks, and preservation of earlier artifacts.
- Obtain independent code and artifact review. These are requirements, not claims of implementation, new tests, or verification results.

The fourth live authorization is consumed; no fifth live attempt is authorized. Release remains TASKED, and known-issues stays unchanged. No authentication, OAuth, model, cleanup, or publication action is authorized by this offline correction. Next: implement and review only the offline correction and independently verify the fourth-run artifact without another live attempt.

## Authorized existing-service connection reuse — bounded info-only plan

The user explicitly authorizes reusing the existing OpenCode connection, not raw credentials, credential copying, a new grant, or authentication changes. This supersedes the requirement to request a new isolated OAuth grant as the only next route; it does not establish connection readiness or authorize provider activation. Release remains TASKED, with no publication or new execution result claimed.

Reuse the already running service. Do not launch a second server sharing user data: pinned-source migration, import, and startup behavior can have side effects. Do not ensure, start, restart, pair, or migrate the service. Do not read host configuration, databases, or provider credentials.

The first live scope is exactly one bounded authenticated `GET /api/info`, using only the existing service transport registration in memory and validating the exact loopback URL, PID, and version. The registration's service password may be used only in memory for Basic authentication, never exposed or written. Pinned source establishes that service info does not initialize location or provider state. Integration/model GETs may activate providers and refresh or write tokens; these calls are not yet cleared. No model generation is authorized.

Acceptance for this bounded plan:
- Obtain independent helper safety audit and offline tests before the one bounded info request; do not treat this record as an audit or execution result.
- Reject mismatched loopback URL, PID, or version without starting or modifying a service; keep transport credentials and raw responses out of persisted or exposed output.
- Do not call integration/model endpoints or infer OAuth/model readiness from service identity.
- Preserve known-issues unchanged and keep the release TASKED; no publish or shipping claim follows from this plan.

Earlier temporary probe helpers, evidence, and source are now absent. Previous verified preflight results remain historical only: do not claim current artifact availability, replayability, or fabricated continuity. The exact source commit `843a6c514e606b436a7fe713422ace0a93ad3d61` has been restored at `/tmp/opencode/connection-reuse-source.hNnhUt/source`. Restoration is not a fresh preflight or live result. Next: independently audit and test the bounded info-only helper before any permitted request; obtain separate clearance before provider-activating calls.

## Authorized minimum generation and separate synthetic inbox plan

After “Pode continuar”, the user explicitly selected “Autorizar teste mínimo”. This supersedes the earlier generation prohibition only for the bounded plan below. Record authorization and requirements, not execution or passing results. Release remains TASKED; known-issues remains unchanged.

Pinned 2.1.2 source establishes that `/api/experimental/generate` uses `Global.Service.config`, not the requested project's configuration. The core path is prompt-only, without session instructions or tools; native provider effective-body overrides can replace the request. A fail-closed pre-generation gate is therefore required.

Requirements and acceptance for the newly authorized scope:
- Create a fresh audited helper, offline tests, and independent safety audit before live execution. Permit only memory-only override PRESENCE checks; never expose or retain override values or raw responses, and do not broaden configuration inspection.
- Use path-only projection of `GET /api/config` at the known current workspace to establish the first directory as global under pinned normal discovery ordering. Do not inspect document info or values, and never display raw configuration. Use that same established global Location for model/integration metadata and subsequent operations.
- Before generation, require exact provider/model `openai/gpt6.1sol`, native package `@opencode/ai/providers/openai`, enabled text model, no selected variant, and effective body and headers absent or empty. Unsafe, malformed, or missing preconditions must stop before generation.
- Native settings and credential metadata may add provider metadata, store, or routing. These are not inspected: do not claim destination assurance, provider retention guarantees, or zero additional configured data. Canonical no-files/no-tools proof is limited to the native body and core path, not a broader provider guarantee.
- Authorize exactly ONE stateless generation API invocation, documenting up to 11 internal provider attempts; no external retry. Fix request counts and deadlines before live execution. Expose only a synthetic-response match boolean, never raw generation output. Existing-connection normal automatic refresh remains permitted.
- Separately create exactly ONE new session at the established global directory. Add a unique synthetic marker to its inbox with delivery `queue` and `resume:false`; reread only that new session's inbox using only the returned new ID. Verify matching item type, delivery, text, and ID. Do not read old sessions, persist the model response, or claim restart durability from this check.
- Do not use tools or project files in generation. No new grant, logout, server restart, database reads, cleanup, commit, tag, publication, or shipping is authorized by this bounded plan. No full model-backed workflow/local-tool checklist PASS follows from the proposed stateless generation or separate inbox check.

Next: prepare the fresh helper and offline tests, then obtain independent safety audit before the single permitted live generation and separate new-session inbox check. Neither operation has a new result in this handoff.

## Authorized isolated no-model runtime inventory — plan only

The fourth no-model attempt was reported to stop at `unknown-skill`; that report has not been independently artifact-verified. The user explicitly chose “Autorizar preflight isolado,” authorizing exactly one fresh isolated no-model candidate runtime-inventory attempt after a new helper, fresh offline tests, and independent audit. This supersedes the prior no-fifth-attempt hold only for this bounded inventory. This records authorization and plan only; no helper, audit, request, or result is claimed. Release remains TASKED.

### Candidate and isolation

- Candidate package is Guarana 1.4.0, packed from the current working tree into a new disposable root under `/tmp/opencode`.
- `opencode --version` currently reports 2.1.2. The primary selects the exact installed v2.1.2 for this no-model runtime check, using pinned source `/tmp/opencode/connection-reuse-v212.21BODL/source`; this does not claim v2.1.2 is latest stable.
- Use fresh, separately rooted `HOME`, `USERPROFILE`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, `XDG_CACHE_HOME`, and `OPENCODE_CONFIG_DIR`, plus an owned loopback service. Never mount or access user authentication, data, or databases; never reuse a running service. No new authentication, configuration edits, host service reuse/start/restart, or cleanup is authorized. Preserve all artifacts.

### Fixed no-model inventory scope

- Only these requests are allowed: `GET /api/info`, `/api/location`, `/api/config`, `/api/plugin`, `/api/skill`, `/api/agent`, and `/api/mcp`. Do not connect to MCP. No integration, OAuth, model, generation, session, inbox, tools, or POST requests are allowed.
- The config API response may exist in memory only and may be projected only to type, path, and classification. Do not project config document `info` or raw values.
- Runtime acceptance requires exactly three active Guarana plugins (`guarana.telemetry`, `guarana.memory`, `guarana.orchestrator`) from candidate-local paths; exactly nine Guarana nested skills (`plan`, `build`, `code`, `verify`, `debug`, `measure`, `remember`, `memory`, `specs`) with display names `guarana:<id>` and candidate canonical paths; exactly four candidate worker profiles (`worker-code`, `worker-verify`, `worker-debug`, `worker-specs`); zero MCP servers; and no unexpected local plugin, skill, or agent origins.
- After plugin readiness, poll only structurally valid empty response arrays matching the candidate location, for at most 10 seconds at 200 ms intervals and no more than 50 requests, respecting the remaining deadline. Malformed, error, or unexpected data fails immediately; no other retries are allowed.
- Emit only fixed safe enums, count buckets, and booleans. Never expose or store raw API, config, skill, agent, prompt, or MCP-error content or credentials. Keep fresh evidence under the private temporary root.
- If any provenance or runtime-inventory gate is failed or unknown, stop without a generation call. A passing isolated local-tool preflight only permits a separately audited global OAuth/model preflight and the already separately authorized single synthetic generation; it is not release validation or proof of token validity, generation, or persistence. The prior consent for exactly one stateless synthetic generation remains conditional on all provenance, local-tool, OAuth, and model gates passing and fresh audit; that generation is outside this preflight.

Next: prepare the new helper, run fresh offline tests, and obtain independent audit; only if all pass may the exactly one isolated no-model runtime-inventory attempt proceed within this scope.

## Post-lock primary candidate gate observations

Worker-debug found `dashboard/package-lock.json` pinned Vite 6.4.3 while the existing `dashboard/package.json` range is `^6.4.3`. Worker-code changed only the lock resolution to Vite 6.4.4; the manifest remained byte-identical and no other package lock changed.

In candidate `/tmp/opencode/guarana-1.4.0-gates.UjTShV`, the primary copied the changed lock and reran `npm ci --prefix dashboard` (142 packages, zero vulnerabilities), `npm audit --package-lock-only --prefix dashboard --audit-level=high` (zero vulnerabilities), and `npm run audit` (zero vulnerabilities in dashboard and dashboard/server).

On Node v24.20.0, the primary reran `npm test` (567/567), `npm run build`, `npm run check-cli`, `npm run specs:validate` (195 files, 0 issues), `npm run smoke:pack` (`guarana-1.4.0.tgz`, 131 files, no `node_modules`), and inspected `npm pack --dry-run --json` (131 entries, required `LICENSE`, `CHANGELOG.md`, and `RELEASING.md`, no `node_modules`). These are primary post-lock checks, not fresh independent release verification. The previous independent criterion-2 result remains FAIL for the old Vite 6.4.3 candidate.

The latest stable release target is v2.1.3, as recorded in acceptance criterion 3: the official GitHub release page identifies tag v2.1.3, tagged 2026-10-22 12:45 UTC at `bb25a2f4a3f3f04d7c344bec0c0574ea3510b3b1`. Host smoke and the separate workflow/task/persistence checklist remain unrun. Release remains TASKED; `.specs/state/known-issues.md` is unchanged. No commit, push, tag, publish, or release claim occurred.

## Authorized bounded model-capability metadata diagnostic

After reviewing the prior independently verified evidence, the user selected “Autorizar diagnóstico limitado.” This supersedes the prior no-further-probe hold only for the exact metadata-only scope below. It records consent and requirements only; no fresh helper, offline test, independent audit, invocation, or result is claimed. The release remains TASKED.

The prior evidence reports exactly one matching target-model catalog reference; modelID, enabled, status, package, and output-capability checks pass; strict text-only input capabilities fail; the body overlay is absent and the headers overlay is nonempty. The underlying values were not inspected.

Before exactly one fresh helper invocation, run fresh offline tests and obtain a fresh independent safety audit. Use only the existing compatible OpenCode 2.1.2 service and the fixed GET scope: `/api/info`, `/api/config` projected to type/path only, global `/api/location`, and `/api/model` at that global location. Do not use integration, generation, sessions or inbox, POST, configuration edits, retries, restart, login, or logout.

Project input-capability shape only to `text-only`, `text-plus-other`, `non-text-only`, or `unknown`. Project headers only to `authorization-related`, `known OpenAI metadata`, `other/custom`, `mixed`, `none`, or `unknown`, plus a coarse key-count bucket. Inspect only descriptor/key names necessary for those categories; never output actual names, values, IDs, or raw responses, and do not inspect header values, settings, or credentials. A model GET may cause ordinary refresh as permitted by prior consent; whether refresh occurs remains unknown.

No release action, publication, tag, or known-issues change is authorized by this diagnostic. No passing result follows from this consent; stop before the single invocation unless both the fresh offline tests and independent audit pass.

## Fresh authorized release gates — 2026-10-22

The user authorized “Refazer gates com nota.” The fresh exact candidate is `/home/arch/.local/share/opencode/worktree/4e62b0/guarana-1.4.0-release-candidate`, containing the complete authorized tracked modifications and six untracked `.specs` files over base HEAD `37d9c1e`. Evidence directory: `/tmp/opencode/guarana-1.4.0-final-gates-20261022T142546`.

The prior managed Proof field was overwritten to `none` by an earlier recorder update. The exact current-source pre-update receipt could not be recovered. The only located copy was `/tmp/opencode/guarana-1.4.0-gates.UjTShV/.specs/features/release/known-issue-status-release.md`, a stale candidate that still requires retired smoke; it was not substituted or reconstructed. The prior proof is unrecoverable; the results below are only the fresh supplied results.

On Node v24.20.0 and npm 12.2.0, all seven ordinary release checks passed on the fresh candidate:
- `npm ci --prefix dashboard` — PASS, 0 vulnerabilities; npm warned that the `esbuild@0.25.12` install script was blocked by npm `allowScripts`.
- `npm ci --prefix dashboard/server` — PASS, 0 vulnerabilities.
- `npm run audit` — PASS, 0 vulnerabilities in both workspaces.
- `npm test` — PASS, 567/567.
- `npm run build` — PASS.
- `npm run check-cli` — PASS.
- `npm run specs:validate` — PASS, 197 Markdown files, 73 features, 36 ADRs, 215 links, zero issues.

`npm pack --dry-run --json` passed as package-content inventory only: `guarana@1.4.0`, `guarana-1.4.0.tgz`, 131 files, includes `LICENSE`, `CHANGELOG.md`, and `RELEASING.md`, and has zero `node_modules` paths. npm 12 returned a JSON object wrapper; the corrected static parser passed. The tarball was not installed or executed. This was not a smoke test.

No smoke test ran. No release action, commit, push, tag, publish, or change to `.specs/state/known-issues.md` occurred. Independent release verification remains pending; release status remains TASKED. ADR-036's smoke prohibition remains in force. These primary gate results do not themselves satisfy the independent-verification acceptance criterion.
