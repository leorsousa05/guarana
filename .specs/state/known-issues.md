# Known Issues

## 2026-10-09 — OpenCode fresh-session variant display disagrees with resolved Guarana agent
- **Symptom:** After a fresh user restart, project Primary settings and `.opencode/agents/guarana.md` specify `gpt-6-luna` variant `low`; `opencode debug config` reports `default_agent: guarana`, model `gpt-6-luna`, variant `low`; and `opencode debug agent guarana` also resolves `low`. The user nevertheless sees `gpt-6-luna medium` in a freshly opened Guarana conversation. The model catalog lists `gpt-6-luna` as supporting `xhigh`.
- **Reproduction trigger:** Open a new Guarana conversation with the stated project profile/config; compare its visible variant with the same-restart debug outputs.
- **Cause / missing evidence:** Unclassified: the report does not establish whether the UI/session's new-session variant selection overrides the agent profile or whether the display reflects the runtime request. The permitted `opencode run --agent guarana --format json` diagnostic did not execute: the shell/tool request triggered an external-directory permission prompt and was auto-rejected, so no fresh runtime model/variant metadata is available. Thus neither runtime use of `medium` nor the UI override behavior is confirmed.
- **Possible mitigation:** No configuration change is justified yet. Obtain permission for the read-only no-tool `opencode run --agent guarana --format json` check and inspect only metadata; separately capture the new-session model/variant selector. If runtime metadata confirms `medium` despite the resolved agent being `low`, explicitly select `low` in the new-session UI (or clear its session-level override) and verify again; if runtime is `low`, treat the UI label as display/session state and report it as such.
- **Status:** Unclassified in the Guarana debug failure-mode matrix; runtime/UI override root cause remains unconfirmed. No product code or configuration changed.

## 2026-10-09 — Guarana Primary variant evidence does not match the claimed xhigh configuration
- **Symptom:** The reported Primary variant is `xhigh` in project settings and `.opencode/agents/guarana.md`, but direct inspection in this checkout shows both are `low`; `opencode debug agent guarana` also resolves `variant: low`. This matches the reported new-session `medium` UI more closely than xhigh, while the report that `opencode debug config` resolves agent variant xhigh conflicts with the live agent debug output.
- **Reproduction trigger:** Inspect `.guarana/advisor.json`, `.opencode/agents/guarana.md`, then run `opencode debug agent guarana` from this project. The current primary settings contain `"variant": "low"`, the profile frontmatter contains `variant: "low"`, and the CLI reports low.
- **Cause / missing evidence:** The observed evidence does not establish an OpenCode variant-resolution defect. The premise that primary configuration declares xhigh is not true in this checkout; xhigh belongs to the Advisor settings, and `opencode debug agent guarana` is concrete resolved-agent evidence for low. The contradictory `debug config` output and UI label need fresh, same-process/same-project captures to explain any remaining discrepancy. The `opencode run` telemetry proves model ID only, not variant.
- **Possible mitigation / next safe diagnostic:** Before changing configuration, capture `pwd`, `opencode --version`, `opencode debug config`, `opencode debug agent guarana`, and `opencode models` from one shell/project, and preserve raw outputs. Separately inspect the newly opened session's selected agent/model/variant and compare its project root; verify whether an existing session or global agent is being used. Once the intended Primary value is confirmed, set it through the supported Guarana advisor settings/profile flow, then repeat both CLI debug commands and verify a fresh session. Do not infer runtime variant from model-only telemetry or change `xhigh`/`medium` blindly.
- **Status:** Unclassified in the Guarana debug failure-mode matrix; concrete configuration evidence contradicts the reported premise, and runtime/UI root cause remains unconfirmed. No code or configuration changed.

## 2026-10-09 — Dashboard API tests retain the pre-rename primary profile name
- **Symptom:** Three assertions in `dashboard/server/app.test.js` fail: two attempt to read `guarana-advisor-primary.md` (ENOENT), and the foreign-artifact conflict test expects HTTP 409 but receives 200.
- **Reproduction trigger:** Run `npm test -- --runInBand dashboard/server/app.test.js`; the actual test script runs the complete Node test suite, in which these three API assertions fail while the Advisor toggle API tests pass.
- **Cause:** The assertions still target the old `guarana-advisor-primary` artifact and ownership-conflict path after the accepted primary profile rename to `guarana`. This is stale test expectation, not a product defect; current artifact naming and ownership behavior use the renamed profile.
- **Mitigation:** Update those test fixture/assertion paths to the accepted `guarana` primary profile name and check conflicts against the current managed artifact; leave API behavior unchanged. No code changed in this diagnosis.
- **Status:** Confirmed by independent run; test updates pending.

## 2026-10-09 — guarana web accepts incomplete dashboard dependencies
- **Symptom:** `npm install --omit=dev` reports success, but Express startup fails in `iconv-lite/lib/index.js` because its required `../encodings` module is missing.
- **Reproduction trigger:** Run `guarana web` with a partial or corrupt `node_modules` tree that contains the directory but is missing the package-root `encodings` dependency required by locked iconv-lite 0.4.24. `cli/commands/web.js` skips installation based only on the `node_modules` directory existing.
- **Mitigation:** Validate that the actual critical dependency can load before skipping installation; when incomplete, perform a clean locked install with `npm ci --omit=dev`.
- **Status:** Resolved; worker-verify `ses_ede9829a6ffeVijrN3ogchiRdd` passed 4/4. `npm run smoke:pack` passed using `guarana-1.1.0.tgz` (99 files, no `node_modules`); packed CLI booted the dashboard and health endpoint. `npm test` passed 280/280; check-cli, specs, and diff checks passed.

## 2026-10-09 — version-bump verification overreached on unknown remote tag state
- **Symptom:** For the authorized 1.1.0 version bump, worker-verify passed criteria 1–3 but criterion 4 remained partial because it could not rule out a pre-existing tag on a remote.
- **Reproduction trigger:** Require proof that no remote tag exists even though the task authorized only a version bump and performed no npm publish, git tag, push, or remote command.
- **Cause:** Overbroad negative-evidence criterion, not a product failure. `npm view guarana@1.1.0` returned E404, which establishes that npm registry lookup did not find that package version; it cannot establish external remote tag state.
- **Mitigation:** Narrow criterion 4 to the factual scope: record that `npm view guarana@1.1.0` returned E404 and that this task issued no publish, tag, push, or remote command. Do not claim that no external remote tag exists; mark the criterion passed on this scoped evidence if it asks whether this task created/published one.
- **Status:** Resolved; worker-verify `ses_edea186ddffed36RSeh9eTt7qC` passed 4/4 after AC4 was scoped to local actions, confirming package 1.1.0 is local/unpublished, `npm view` returned E404, no local matching tag exists, and this task invoked no publish/tag/push.

## 2026-10-09 — worker-specs stdin payload blocked by OpenCode permission check
- **Symptom:** Post-restart smoke ran `guarana specs record --stdin` and returned `{"ok":false,"changed":[],"error":"invalid JSON"}`; no files were changed.
- **Reproduction trigger:** With `bash: { "*": "deny", "guarana specs record --stdin": "allow", "node bin/guarana.js specs record --stdin": "allow" }`, invoke the allowlisted command with a JSON heredoc as stdin. OpenCode blocks providing the heredoc content, while the command executes with empty stdin.
- **Cause:** Confirmed tool-permission/input-delivery failure: the allowlisted command string permits command execution but does not authorize the heredoc payload under the restrictive Bash policy. The empty-stdin CLI error is a consequence, not a specs/JSON processing defect.
- **Mitigation:** Prefer a supported stdin-input mechanism or dedicated tool that supplies the JSON without broadening shell access. If a file intermediary is required, narrowly allow the specific safe input-delivery operation/path and the exact `guarana specs record --stdin` command; do not relax `bash: "*": "deny"` or add a general shell/redirection allow rule. Verify the CLI receives valid JSON before treating the smoke as passed.
- **Status:** Unclassified in the guarana debug failure-mode matrix; classified for this incident as a tool/permission failure. No files changed; mitigation recommended, not applied.

## 2026-10-09 — Advisor CLI tests retain pre-rename configuration assumptions
- **Symptom:** `node --test cli/lib/advisor.test.js` fails 5/12 tests after Advisor settings/profile rename work.
- **Reproduction trigger:** Run the focused test. Failures: expected 3 artifacts but got 2; expected 2 removals but got 1; expected setup-only with complete primary settings; expected advisor settings to omit a just-set model; expected advisor agent file after setting provider/model/variant but without enabling Advisor.
- **Cause:** These assertions reflect the older required-Advisor / three-artifact contract. Current implementation requires `advisor.enabled === true` with advisor provider/model to emit the separate advisor agent; primary provider/model alone enables the command and primary agent. `set` persists supplied fields, including advisor.model. These assertions alone do not establish a product defect; migration/CLI coverage remains incomplete and behavior must be judged against the intended contract.
- **Possible mitigation:** Complete settings/profile migration and CLI tests against the intended optional/enabled Advisor contract; explicitly configure `advisor.enabled` where a third artifact is expected. Do not alter product behavior solely to satisfy stale assertions.
- **Status:** Unclassified in the Guarana debug failure-mode matrix; independently reproduced. No code changed; implementation and migration behavior still require completion/verification.

## 2026-10-09 — live worker-specs result omitted from record-command proof handoff
- **Symptom:** Independent worker-verify `ses_edeea5f56ffeoUM08LaKft3KHW` passed criteria 1–5 but failed criterion 6 because `.specs/features/orchestrator/spec-record-command.md` does not record the live worker-specs session result, although the specs update occurred.
- **Reproduction trigger:** Complete `worker-specs` via `guarana specs record --stdin` and request independent verification without carrying the worker session result into the feature proof receipt.
- **Cause:** Handoff omitted proof of live worker invocation; this is a documentation/evidence gap, not a command failure. Worker-specs `ses_edefeb199cffehjnKftd43HFAc5` returned `ok:true`, changed README/project-state/feature, and reported validator ok.
- **Possible mitigation:** Add a proof line to the managed receipt in `.specs/features/orchestrator/spec-record-command.md` identifying the `worker-specs` session and recording `ok:true`, changed paths (README, project-state, feature), and validator `ok`; rerun independent verification. Keep the result explicitly pending until that verify passes.
- **Status:** Resolved; worker-specs `ses_edee909ccffeS5e2S4z9vl04HV` recorded the original successful call `ses_edefeb199cffehjnKftd43HFAc5` (`ok:true`, 3 paths, validator true), and independent worker-verify `ses_edee8733affeL3ugYU3cvuuoxQ` passed all 6 criteria including the receipt.

## 2026-10-09 — worker-specs permission paths did not match
- **Symptom:** `worker-specs` could not write its permitted `.specs` records.
- **Reproduction trigger:** Apply OpenCode permission rules using `**/` prefixes to the worker-specs and worker-debug paths.
- **Cause:** Independent worker-debug `ses_edefdafe5ffeMpnJvKE31omDBe` confirmed OpenCode permission rules treat `*` as the wildcard and do not implement `**` as a globstar.
- **Mitigation:** Remove `**/` from the worker-specs and worker-debug paths; reload OpenCode.
- **Status:** Resolved; worker-specs writes work after reload. The ADR-030 independent verification passed; this closure concerns only the permission blocker.

## 2026-10-08 — Advisor runtime trace absent from a process with stale project plugins
- **Symptom:** A live Advisor Task returned and token telemetry observed `openai/gpt-5.6-luna`, but no `advisor-execution` event or observed variant was written.
- **Reproduction trigger:** Update project plugin files while an existing OpenCode process still has older plugin code loaded, then invoke `guarana-advisor` in that process.
- **Mitigation:** Run `guarana plugin install --project` (done; project plugin status is current), restart/reload OpenCode so it loads the updated telemetry plugin, then issue a fresh `/guarana-advisor` task.
- **Status:** Resolved (2026-10-08). After `guarana plugin install --project` and OpenCode reload, child session `ses_ee18381a9ffe1ZVwyYLf4B7FVu` emitted sanitized `advisor-execution` events with parent `ses_ee39ce5c0ffeA5wDL8irBmzskV`, `openai/gpt-5.6-luna`, and observed variant `xhigh`.
- **Reason-capture follow-up:** A later stale project plugin also omitted the consultation `reason`; after reinstall/reload, live child `ses_edf12824affeTImYKdFojUTX8x` emitted dispatch event 67004 with `reason=Verificar captura do motivo` and matching parent/child/call correlation. Reason-capture regression is resolved and validated.

## 2026-10-07 — fresh-project specs bootstrap omitted required tracker heading
- **Symptom:** A provider-backed smoke in an isolated fresh project failed `guarana specs validate` because generated `.specs/README.md` lacked `## Master tracker`; this prevented the independent verification from passing and the workflow from completing.
- **Reproduction trigger:** Start a task in a project with no `.specs/` directory, then run `guarana specs validate <project> --json`.
- **Mitigation:** Add the required heading and goal fields to `ensureSpecs()` output, keep the shipped CLI mirror synchronized, and test the generated scaffold using the shipped validator.
- **Status:** Fix implemented; regression test passed. Final packed-candidate validation pending.

## 2026-10-07 — overlapping npm ci targets raced in nested dashboard workspaces
- **Symptom:** `npm ci --prefix dashboard` exited with ENOTEMPTY while `npm ci --prefix dashboard/server` was running concurrently; the server workspace is nested beneath the dashboard workspace.
- **Reproduction trigger:** Start both release-gate `npm ci` commands at the same time.
- **Mitigation:** Run the parent and nested workspace installs sequentially, then rerun the parent install if the failed operation left partial `node_modules` cleanup.
- **Status:** Resolved (2026-10-07); running `npm ci --prefix dashboard` and then `npm ci --prefix dashboard/server` sequentially passed.

## 2026-10-07 — dashboard release audit found newer advisories
- **Symptom:** After clean dashboard workspace installs, audit reported critical `proxy-addr` 2.0.7 and high `source-map-js` 1.2.1 advisories.
- **Reproduction trigger:** Run the release-gate `npm run audit` against the current dashboard and standalone server lockfiles.
- **Mitigation:** Apply non-forced `npm audit fix`; lockfiles now resolve `proxy-addr` 2.0.8 and `source-map-js` 1.2.2.
- **Status:** Resolved (2026-10-07); both dashboard workspaces now audit with zero vulnerabilities after the lockfile patch updates.

## 2026-10-08 — advisor command setup, XDG discovery, and repeat-dispatch gaps
- **Symptom:** Independent verification found the global advisor command and profiles were not discovered under an isolated `XDG_CONFIG_HOME`; incomplete settings removed the command instead of explaining setup; and repeated advisor calls for the unchanged blocker had no runtime guard.
- **Reproduction trigger:** Configure temporary `HOME` and `XDG_CONFIG_HOME`, install/check global advisor artifacts with OpenCode 1.18.35; then inspect artifacts with incomplete settings; inspect Task dispatch after an advisor has already advised on the same blocker.
- **Mitigation:** Resolve global OpenCode artifacts from `XDG_CONFIG_HOME/opencode` with `~/.config/opencode` fallback; always install an actionable setup command even before models are configured; add a `tool.execute.before` guard keyed by parent session and normalized advisor Task context so an unchanged consultation is rejected while new evidence can form a new blocker.
- **Status:** Resolved (2026-10-08); XDG discovery, setup-only command behavior, and runtime consultation guard passed independent worker-verify `ses_ee34bd63fffedhz1AzXY8VJ3NQ`.

## 2026-10-08 — dashboard Models route imports break in the CLI mirror
- **Symptom:** Canonical dashboard API tests pass, but the copied CLI route imports the shared advisor modules from nonexistent `cli/cli/lib/*` paths, preventing the packaged dashboard from loading `/api/models`.
- **Reproduction trigger:** Run the CLI bundle sync, then resolve imports from `cli/dashboard/server/routes/models.js` or start the packed dashboard with its server dependencies provisioned.
- **Mitigation:** Resolve the shared settings/profile modules from the canonical or mirrored relative location according to which file exists; retain one implementation and keep the canonical/mirrored route compatible.
- **Status:** Resolved (2026-10-08); source and CLI mirrored route resolution and GET/PUT integration passed 13/13 each after the declared server dependency was provisioned; independent worker-verify `ses_ee34bd63fffedhz1AzXY8VJ3NQ` passed criterion 3.

## 2026-10-08 — connected-model parser rejects OpenCode auth table rows
- **Symptom:** OpenCode 1.18.35 `auth list` emits rows such as `● OpenAI api`; the advisor catalog parser treats the status glyph as a provider ID and discards all models.
- **Reproduction trigger:** Use an isolated OpenCode auth fixture, run `opencode auth list`, then query `guarana advisor models` or `/api/models/catalog`.
- **Mitigation:** Check raw byte/secret constraints, strip ANSI and box-drawing borders, then skip only anchored auth-table headers/footers and normalize provider labels. Retain strict validation for unknown rows and never expose credential fields.
- **Status:** Resolved (2026-10-08); parser accepts the actual OpenCode 1.18.35 ANSI/bordered auth output, returns only connected providers, and excludes credential data. The regression fixture now matches standalone separators and unboxed provider rows; independent worker-verify `ses_ee29073ddffeJLQyalwccEqndE` passed catalog criteria 8–10 and original packaged criterion 7. Worker-debug appends were denied and backfilled by primary.

## 2026-10-08 — mirrored model-catalog test imports the source-only path
- **Symptom:** The CLI-mirrored dashboard app test imports `../../cli/lib/opencode-model-catalog.js`, resolving to nonexistent `cli/cli/lib/*`; 13/14 mirrored tests pass.
- **Reproduction trigger:** Run `node --test cli/dashboard/server/app.test.js` after provisioning its server dependencies.
- **Mitigation:** Resolve `opencode-model-catalog.js` through the existing shared advisor module resolver, which supports canonical and mirrored directory depths.
- **Status:** Resolved (2026-10-08); mirrored test now resolves via the shared module resolver; canonical and CLI-mirrored app suites passed 14/14 each in worker-verify `ses_ee3017d86ffeLzNHVsn410YHJa`. Worker-debug append was denied and backfilled by primary.

## 2026-10-08 — OpenCode tilde model IDs rejected by advisor configuration
- **Symptom:** `opencode models` includes IDs such as `openrouter/~anthropic/claude-fable-latest`, but the advisor catalog/settings validators reject the leading tilde. Disconnected-provider catalog rows were also validated before filtering and could invalidate the catalog.
- **Reproduction trigger:** Run `guarana advisor models` with OpenCode's catalog containing a tilde alias, or select/save that alias in advisor settings.
- **Mitigation:** Filter to authenticated providers before model-ID validation; allow OpenCode's `~` alias and nested path characters in model IDs while retaining strict whitespace/control validation; preserve the exact ID through settings and generated profiles.
- **Status:** Worker-code `ses_ee2807e88ffeEdcANnuFKqrOfi` implemented discovery/settings/profile round-trip; focused tests passed 36/36. Independent verification is pending.

## 2026-10-08 — model UI verification omitted host/viewport evidence
- **Symptom:** Independent verification passed code and full-suite evidence but did not run an isolated OpenCode ID/profile/variant smoke or a rendered 375px overflow check, leaving follow-up criteria unverified.
- **Reproduction trigger:** Request a verification run for model-ID round-trip, verbose variant metadata, and responsive Models page without explicit isolated OpenCode and viewport checks.
- **Mitigation:** Rerun worker-verify with isolated OpenCode CLI/profile/variant steps and a browser/renderer check at 375px; no production code change is implied unless the evidence reveals a behavior defect.
- **Status:** Worker-debug `ses_ee268b26effeSfG9cB2z2Co45C` classified the gap as unclassified; worker-verify `ses_ee25d6649ffe1U79F8m3KOW3xY` repeated the omission. Direct isolated host and rendered 375px evidence remain required before criteria 11–13 can be closed. Worker-debug append was denied and backfilled by primary.

## 2026-10-08 — workflow remained in verification after a scope-expanded code slice
- **Symptom:** An implementation slice landed while persisted workflow state was `verifying`; `workflow_tick(code_complete)` was rejected, and the orchestrator auto-routed to debugging.
- **Reproduction trigger:** Expand implementation scope during a verification-evidence follow-up, continue editing before re-planning/re-entering coding, then report `code_complete` from `verifying`.
- **Mitigation:** On consequential scope expansion, replan and re-enter coding before dispatch. If code is already complete after a misroute, record recovery and restore the lifecycle before independent verification.
- **Status:** Worker-debug `ses_ee263ad87ffeE2jDPO1IMT4F5p` classified this as an unclassified workflow-process issue; it recurred once during the single-variant UI correction after a duplicate `code_complete` call. No product failure; lifecycle state is being resynced before verification. Worker-debug append was denied and backfilled by primary.

## 2026-10-08 — Models UI test expectations drifted during accessibility/copy refinement
- **Symptom:** The focused Models test failed because its combobox assertion required `id` and `role` attributes to be adjacent, and its variant-status assertion expected copy that had changed during the UI refinement.
- **Reproduction trigger:** Run `node --test dashboard/web/src/components/Models.test.mjs` after adding accessible names and updating variant guidance without updating the brittle assertions.
- **Mitigation:** Match the semantic attributes without assuming order and assert the current user-facing status. The focused test passes after updates.
- **Status:** Resolved (2026-10-08); `node --test dashboard/web/src/components/Models.test.mjs` passed. Worker-debug `ses_ee21daf69ffeYFLVankGRzlJn1` classified this as test-contract drift, not a product defect.

## 2026-10-08 — model combobox does not reopen after selecting a result
- **Symptom:** After selecting a model, typing a second query in the still-focused model input leaves its result list closed (`aria-expanded=false`), so the next search cannot select another model without refocusing.
- **Reproduction trigger:** In Chromium, select a model from the searchable model combobox, then type a different model query without blurring the input.
- **Mitigation:** On model-input edits, restore the combobox active state at index -1 while updating the query; add a rendered select-then-type regression test.
- **Status:** Resolved (2026-10-08); worker-code `ses_ee21216ceffeGwVdnvVwTST3kg` added the active-state reset. Fresh independent worker-verify `ses_ee2108fb7ffeSOXgqI0JuCwNPK` confirmed model search reopens and supports select→type→select for both roles.

Open problems and material failures from the build. Entry format: title / symptom / reproduction trigger / effective or possible mitigation / status.

## 2026-10-05 — automatic skill policy omitted simple-task non-signal
- **Symptom:** The policy excluded one-off deliverables and technical complexity alone but did not explicitly name a simple task; focused tests did not pin each create/no-create signal.
- **Reproduction trigger:** Review the trigger-guidance acceptance criteria against the always-on policy and its assertions.
- **Mitigation:** Name simple tasks as non-signals and assert each positive trigger, negative signal, and ambiguous-no-create boundary.
- **Status:** Resolved (2026-10-05); independent verification confirmed the explicit non-signal and focused assertions.

## 2026-10-05 — release-readiness feature proof was not recorded before verification
- **Symptom:** The independent verifier passed the implementation checks but failed acceptance criterion 8 because exact command outcomes were absent from the feature spec and tracker status remained IMPLEMENTED.
- **Reproduction trigger:** Finish implementation checks without writing them to the task-specific feature proof before requesting independent verification.
- **Mitigation:** Record the verifier's exact results and host-smoke boundary in the feature spec, then recheck the proof before marking the tracker VALIDATED.
- **Status:** Resolved (2026-10-05); exact command outcomes were recorded and independent verification confirmed criterion 8 and the final status/link consistency.

## 2026-10-05 — npm pack JSON manifest shape varies by npm version
- **Symptom:** The packed-CLI smoke expected `npm pack --json` to return an array, but the installed npm returned an object keyed by package name, so the smoke could not read the archive manifest.
- **Reproduction trigger:** Run `npm run smoke:pack` with an npm version that emits a keyed-object pack manifest.
- **Mitigation:** Normalize array and keyed-object manifests before validating and installing the archive.
- **Status:** Resolved (2026-10-05); the smoke parses the installed npm's manifest shape and then exercises the packed CLI.

## 2026-10-02 — npm pack JSON output polluted by prepack output
- **Symptom:** The packed-CLI smoke test could not parse `npm pack --json` because the prepack bundle-check message was written to stdout before the JSON document.
- **Reproduction trigger:** Run `npm run smoke:pack` with a prepack script that writes status output to stdout.
- **Mitigation:** Send the prepack check's human-readable output to stderr; keep stdout machine-readable for npm's JSON result.
- **Status:** Resolved (2026-10-02); `npm run smoke:pack` passes and parses the pack manifest.

## 2026-10-02 — packed CLI resolved install assets outside the npm package
- **Symptom:** `guarana install --project` from an installed npm tarball failed with ENOENT for `<prefix>/node_modules/guarana/skills/guarana`.
- **Reproduction trigger:** Install the npm tarball into an isolated prefix, then run `guarana install --project`.
- **Mitigation:** Resolve skills, plugins, engines, and dashboard assets relative to the bundled `cli/` directory.
- **Status:** Resolved (2026-10-02); `npm run smoke:pack` installs from the actual tarball and completes install/list/plugin health/uninstall.

## 2026-10-02 — project install path was not discovered by OpenCode
- **Symptom:** `opencode debug skill` did not list Guarana skills after `guarana install --project` placed them under `./skills/guarana/`.
- **Reproduction trigger:** Install the packed CLI into a temporary project and inspect OpenCode's resolved project skills.
- **Mitigation:** Install project skills under `./.opencode/skills/guarana/`, the directory recognized by OpenCode.
- **Status:** Resolved (2026-10-02); the OpenCode host smoke check confirms `guarana:plan` is discoverable.

## 2026-10-02 — dashboard dependencies had published advisories
- **Symptom:** `npm audit` reported one high Vite/esbuild advisory and moderate `qs` advisories in Express dependencies.
- **Reproduction trigger:** Run `npm audit --prefix dashboard` and `npm audit --prefix dashboard/server`.
- **Mitigation:** Upgrade the dashboard build toolchain to patched Vite 6.4.3/plugin-react 4.7.0 and refresh both lockfiles with safe audit fixes.
- **Status:** Resolved (2026-10-02); both dashboard audits report zero vulnerabilities.

## 2026-08-22 — dashboard: token totals absent, NOW goal hidden, specs missing goal field
- **Symptom:** Telemetry summary always reported `tokens: 0`; the NOW panel never showed the open goal; newly scaffolded project-state lacked a `Goal:` checkpoint line.
- **Reproduction trigger:** Run the dashboard with real telemetry produced by `plugin/guarana-telemetry.js` (writes `tokens` as an object), or view the NOW panel with no runs / a freshly scaffolded `.specs/`.
- **Mitigation:** Plugin now emits a numeric token total; NOW panel renders the parsed goal even when telemetry is empty; `guarana:plan` and `guarana:remember` instructions explicitly require a `- Goal:` line in the project-state checkpoint.
- **Status:** Fixed (plugin + dashboard UI + skill instructions updated 2026-08-22); worker-verify PASS.

## 2026-08-31 — installed memory plugin can never load the engine (memory_* tools error)
- **Symptom:** Every `memory_*` tool (`memory_search`, `memory_save_decision`, `memory_get_context_for_task`, `memory_review_draft`) returns `memory engine not available` in a live session. Telemetry logs the call as `ok:true` (handler returns an error string, does not throw).
- **Reproduction trigger:** Run the memory plugin as actually installed by `guarana plugin install` — a **standalone copy** at `~/.config/opencode/plugins/guarana-memory.js`. Its `loadEngine()` resolves `../memory` relative to that file → `~/.config/opencode/memory` and `~/.config/memory`, neither of which exists, so it returns `null`. Slice-3 tool tests passed only because they ran the plugin **in-repo** (`plugin/../memory` exists). Exposed by the final-gate end-to-end resume scenario.
- **Secondary finding:** the installed copy is **stale** — an older 11.1K version missing the Slice-4 `compact` integration present in the repo `plugin/guarana-memory.js` (12.1K). Install was performed before the compact change; nothing re-syncs installed copies to the repo.
- **Mitigation:** make the plugin self-contained (the installer copies `memory/` alongside the plugin and resolves from there), or have the installer place the engine at `~/.config/opencode/memory`, or re-run `guarana plugin update` after syncing the bundle. Must not hardcode project paths (ADR-004/no project-specific facts).
- **Fix (2026-08-31):** `cli/commands/plugin.js`, `cli/constants.js`, `cli/lib/paths.js` — the installer now deploys the `memory/` engine to `<pluginsParent>/memory` (`~/.config/opencode/memory` global, `./.opencode/memory` project), which the plugin's existing `../memory` resolution locates. New regression test `plugin/guarana-memory.deploy.test.mjs`. `npm run sync-cli` re-synced the bundle.
- **Verification (2026-08-31):** independent worker-verify PASS (5/5): install deploys engine; stale copies refresh via marker guard; installed-copy `memory_save_decision` writes a confirmed node (no "memory engine not available") and `memory_get_context_for_task` returns a bounded subgraph; no env-specific paths; `npm test` 94/94 + `check-cli` pass. Deployed to real env: `guarana plugin install` → `updated memory engine -> ~/.config/opencode/memory`, plugin byte-identical to bundle.
- **Status:** **RESOLVED.** Fix applied/verified/deployed; final gate re-run in a fresh session **PASSED** (2026-08-31): `memory_save_decision` persisted confirmed nodes, `memory_get_context_for_task` recovered decisions/rejected alternatives/bug from the live installed plugin. Memory feature closed. Remaining only version bump + commit.

## 2026-08-21 — plan session skipped remember restore steps 2–3 and end-of-task state write
- **Symptom:** During the CLI feature run, the main thread restored only `.specs/README.md` (step 1) and skipped `state/project-state.md` and the ADRs; it also closed the task without the mandatory end-of-task write to `project-state.md`.
- **Reproduction trigger:** A run that starts from a tracker that looks "all done" — temptation to treat steps 2–4 as skippable.
- **Mitigation:** Restore order is "always, in this exact order" — no short-circuit even when the tracker says DONE. Detected via human audit question; state and checkpoint backfilled same day.
- **Status:** Fixed (state backfilled 2026-08-21); watch for recurrence on "green board" sessions.

## 2026-09-09 — verifier treated successful diff prose as a failed tool result
- **Symptom:** While the workflow was in `verifying`, a successful `git diff` was classified as a failed tool result because changed documentation contained ordinary words such as "failed" and "failure".
- **Reproduction trigger:** Run a successful text-producing command during verification whose output contains failure vocabulary in prose.
- **Mitigation:** Match error-shaped output lines (`Error:`, `not ok`, `FAIL`, `failed` at line start, process exit errors, or JSON error fields) instead of arbitrary occurrences inside prose.
- **Status:** Fixed in `orchestrator/decide.js`; regression coverage added to `orchestrator/workflow.test.js`.

## 2026-09-09 — multiline task Markdown flattened in roadmap
- **Symptom:** Large AI-created goals and `NEXT` entries rendered as one paragraph, exposing inline `#` headings instead of separate Markdown blocks.
- **Reproduction trigger:** Bootstrap specs from a task containing multiline Markdown, or view specs created before multiline preservation was added.
- **Mitigation:** Preserve task newlines when generating specs, collect multiline tracker flags, and recover heading boundaries in the Markdown renderer for legacy one-line content.
- **Status:** Fixed in `orchestrator/specs.js`, `dashboard/server/lib/specs.js`, and `dashboard/web/src/lib/markdown.jsx`; regression coverage added to the orchestrator and dashboard parser tests.

## 2026-09-27 — workflow entered debugging after successful verification command
- **Symptom:** Workflow transitioned from `verifying` to `debugging` after a successful `git diff --check`; attempting `verify_pass` was then rejected as an illegal transition.
- **Reproduction trigger:** Run `git diff --check` during verification when the tool returns no output.
- **Mitigation:** `resultFailed` treats empty tool output as success and only recognizes explicit error-shaped output; capture the actual hook payload if the report recurs.
- **Status:** Closed as not reproduced (2026-10-02); empty-string and empty-output regressions are covered by `orchestrator/workflow.test.js`.

## 2026-09-27 — completion-memory removal initially missed workflow_tick call site
- **Symptom:** The orchestrator determinism test failed because `workflow_tick` still called the removed `saveCompletionMemory` helper.
- **Reproduction trigger:** Remove the helper and chat-driven completion call while leaving the workflow-tool completion call.
- **Mitigation:** Remove both completion call sites; regression test now asserts workflow completion leaves existing memory unchanged.
- **Status:** Resolved (2026-09-27); both completion call sites were removed and regression coverage passes in `plugin/guarana-orchestrator.test.mjs` and the full suite.

## 2026-09-28 — memory tool test read the real user's global preference vault
- **Symptom:** The context-size assertion saw two extra user preference nodes when `memory_get_context_for_task` defaulted to both scopes.
- **Reproduction trigger:** Run the scoped memory tool tests with the real `HOME`; the global vault contains durable preferences used by production retrieval.
- **Mitigation:** Give the test suite a temporary home directory and restore `HOME` after each test; count all typed context groups.
- **Status:** Resolved (2026-09-28); tests use a temporary HOME and the full `npm test` suite passes.

## 2026-09-28 — API test fixture omitted isolated HOME declarations
- **Symptom:** The memory API test setup referenced `oldHome` and `projectMemory` without declaring them.
- **Reproduction trigger:** Run `node --test dashboard/server/app.test.js` after adding the injection fixture.
- **Mitigation:** Declare fixture-scoped bindings, isolate HOME for the global vault, and restore it in teardown.
- **Status:** Resolved (2026-09-28); the fixture isolates HOME and `dashboard/server/app.test.js` passes.

## 2026-09-28 — specs validator self-test used the parent directory as project root
- **Symptom:** The current-repository validator test reported all required `.specs` paths missing.
- **Reproduction trigger:** Resolve the repository root with one extra `..` from `cli/commands/specs.test.js`.
- **Mitigation:** Resolve the project root as two parent directories from the test file.
- **Status:** Resolved (2026-09-28); the project-root calculation is corrected and `npm run specs:validate` passes.

## 2026-09-28 — global graph test assumed reversed project edge direction
- **Symptom:** The scope graph test expected the seeded project edge to originate at the selected decision, but the fixture stores it as an incoming dependency.
- **Reproduction trigger:** Run `node --test dashboard/server/lib/memory.test.js` after adding global graph coverage.
- **Mitigation:** Assert that the expected project node is either endpoint of the correctly scoped edge.
- **Status:** Resolved (2026-10-02); focused `dashboard/server/lib/memory.test.js` and the full suite pass.

## 2026-10-09 — OpenCode model catalog discovery intermittently exceeds command timeout
- **Symptom:** Catalog discovery could time out and leave the dashboard without discovered models; manual provider/model entry remained available.
- **Reproduction trigger:** Safe instrumentation recorded `opencode auth list` taking 2931ms and `opencode models` exceeding the previous per-command `COMMAND_TIMEOUT_MS=5000`; the child was killed after 5075ms. No raw command output or secrets were recorded.
- **Root cause:** `opencode models` was killed by the previous 5000ms command timeout. This establishes the timeout trigger, not why the command took that long.
- **Mitigation / limits:** With user approval, auth and models command timeouts are now 15000ms per command (`cli/lib/opencode-model-catalog.js:5,158,193,206`). The UI displays safe discovery errors and retains manual fallback (`dashboard/web/src/components/Models.jsx:137-150`); catalog loading is visibly accessible and its spinner respects reduced-motion preferences (`Models.jsx:188-190`, `style.css:1122-1132,1329-1331`). Commands exceeding 15 seconds can still time out, but the UI now shows the safe reason and manual fallback. This mitigates timeout handling; it does not eliminate all discovery latency or timeouts.
- **Verification:** Independent worker-verify PASS; focused tests 14/14, `npm test` 293/293, build, check-cli, specs validation, and diff check passed.
- **Status:** Mitigated; discovery commands may still exceed the 15000ms per-command timeout.

## 2026-10-09 — Models provider override can retain an incompatible effective global model
- **Symptom:** Changing the project Provider override to `openai` while inheriting global model `claude-opus-4` left an incompatible effective provider/model pair, and the UI permitted saving it.
- **Reproduction trigger:** Set a global model to `claude-opus-4`, then change the project Provider override to `openai` without committing a project model; observe the effective model remain `claude-opus-4` and save the warning state.
- **Resolution:** `Models.jsx` computes `providerModelMismatch` / `hasProviderModelMismatch`, shows actionable validation, disables Save, and blocks submit when the project provider differs from the effective global provider and no explicit project model exists. Inheriting a model from the same provider remains allowed. Manual custom model IDs are explicitly accepted; no generalized API catalog-compatibility validation was added.
- **Verification:** `Models.test.mjs:84-124,150-176` verifies the mismatched-pair guard, same-provider inheritance, catalog selection, manual-ID acceptance, and submit blocking. Independent worker-verify passed all 9 criteria; actual Chromium render at 375x812 has no Models overflow; the final feature is **VALIDATED**.
- **Status:** Resolved; implementation and regression behavior independently verified. Scope remains limited to the Models UI provider-override save path.
