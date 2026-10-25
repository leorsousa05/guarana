# Feature spec: Guarana 1.5.0 Version Bump

**Status: TASKED**

## Goal
Deliver Guarana 1.5.0 as a Stable GitHub release by pushing one reviewed Conventional Commit to `origin/main`, waiting for Node 22.x and 24.x GitHub CI to pass, and then pushing the matching `v1.5.0` Git tag. Include all 72 authorized non-local pending paths that pass the required path-by-path review, plus necessary stable-release metadata and records; the release is not limited to the previously validated blocker-recovery, atomic workflow kickoff, and progress-reporting feature. A separately human-authorized audit-remediation scope adds exactly two lockfile paths solely for the specified vulnerability fix; it does not change the original 72-path review scope or other release boundaries. Make no formal LTS-duration or maintenance promise and do not publish to npm.

## Requirements
- Keep the package version at 1.5.0 and update `README.md` and `CHANGELOG.md` from unpublished-candidate wording to Stable GitHub/tagged-release wording; preserve historical 1.4.0 and `[Unreleased]`.
- Derive the Stable 1.5.0 changelog summary from the full path-by-path review of the included authorized paths and applicable existing feature proof. Date the Stable 1.5.0 changelog heading with the actual release/tag date; do not reuse the 2026-10-22 unpublished-candidate date as the Stable release date. Include every user-facing change among those paths that the review establishes as intended and existing proof validates, including any qualifying Dashboard Activity, Memory, Overview, connected provider/model catalog, model-variant, and telemetry changes as well as the original blocker-recovery, atomic workflow kickoff, and progress-reporting changes. Do not limit the summary to those original three areas, and do not claim unreviewed or unvalidated changes.
- State that 1.5.0 is Stable without promising a formal LTS duration or maintenance period. Do not run `npm publish`, set an npm dist-tag, or create a GitHub Release page unless the user later explicitly requests it.
- Before staging, review every path in the complete current non-local candidate inventory path by path for intent, secrets/private local configuration, and source/distribution parity; the current audit table covers all 78 current paths (45 tracked modified/deleted and 33 untracked non-ignored). Preserve the original human authorization for 72 initial pending paths and its exclusion boundary: the historical inventory was 39 tracked changed/deleted paths plus 34 untracked paths, excluding `.guarana/web.json` because it contains only the local `{appearance.theme:'dark'}` preference, and excluding ignored `.guarana/memory`, advisor, and install-manifest paths. The exact historical mapping from the current 78 paths to the original 72 cannot be asserted because the exact original manifest was not preserved; do not invent a mapping. No unreviewed current candidate path may be staged. Include necessary stable-release metadata and records; do not force-add ignored files.
- The human-approved audit-remediation authorization adds only `dashboard/package-lock.json` and `dashboard/server/package-lock.json`, solely to resolve high-severity `GHSA-27r3-jxmh-p828` affecting `body-parser` versions `<1.20.9`. The observed starting `body-parser` lock entries are `1.20.8` in both files. Resolve both to fixed `1.20.9` or another compatible patched version; do not change either package manifest or unrelated dependency versions, review the lockfile diff for unrelated churn, and rerun `npm ci --prefix dashboard`, `npm ci --prefix dashboard/server`, and `npm run audit`.
- Apply the release gates in `RELEASING.md` and ADR-036: dependency setup as required, `npm run audit`, full `npm test`, `npm run build` including CLI synchronization, `npm run check-cli`, specs validation, and `git diff --check`. Do not run retired package/release/OpenCode-host smoke tests.
- Obtain fresh independent `worker-verify` PASS on the exact release candidate before creating one reviewed Conventional Commit. Push that commit ordinarily to `origin/main`; verify Node 22.x and 24.x GitHub CI passes before creating and ordinarily pushing tag `v1.5.0`. Verify the exact remote commit and matching remote tag.
- Keep this feature status TASKED until proof confirms the remote release tag. No release operation is authorized during this planning write.

## Assumptions and scope
- The blocker-recovery and atomic-kickoff feature is already VALIDATED. The current checkout is `main`, aligned with `origin/main` at `f12863b`; package metadata is already 1.5.0 and describes an unpublished candidate; no local `v1.5.0` tag exists.
- The human decision is to ship version 1.5.0 as Stable through GitHub `main` plus matching Git tag `v1.5.0`, with no formal LTS-duration/maintenance promise and no npm publication.
- The authorized initial pending inventory is 73 paths; `.guarana/web.json` is explicitly excluded as local theme preference, leaving 72 initial pending paths to review. Ignored memory, advisor, and install-manifest paths are outside authorization.
- Scope includes the authorized path review, necessary stable-release metadata and records, release gates, independent candidate verification, one commit, ordinary push, CI confirmation, and matching tag proof. This planning update changes only the existing release feature narrative and recorder-owned `.specs` fields; it does not edit source or perform release operations.

## Human-authorized audit remediation addendum

At the human-authorization handoff, before worker-code edits, the original audit failure was unresolved. The only additional paths approved beyond the original 72-path review scope are `dashboard/package-lock.json` and `dashboard/server/package-lock.json`, and that approval is solely for fixing the vulnerable compatible transitive `body-parser` lock entry. The exact failure is high severity `GHSA-27r3-jxmh-p828`, affecting versions `<1.20.9`; both lockfiles were observed at `body-parser` `1.20.8`. At that earlier handoff, the statement “No remediation edits or checks have occurred yet” was true; it is historical only. Current-candidate remediation results are recorded in [Current-candidate audit remediation proof](#current-candidate-audit-remediation-proof). This addendum does not authorize staging, commit, push, tag, npm publication, or a GitHub Release page; it makes no formal LTS promise, does not permit retired smoke tests, and makes no claim of shipping or of any newly passed gate.

## Acceptance criteria
1. Root package metadata remains version 1.5.0; `README.md` and `CHANGELOG.md` describe a Stable GitHub/tagged release and retain historical 1.4.0 and `[Unreleased]`. The 1.5.0 changelog summary is derived from the reviewed included paths and applicable existing feature proof, covers every included user-facing change established as intended and validated by that review/proof—including qualifying changes beyond the original three feature areas—and excludes unreviewed or unvalidated changes.
2. Release wording makes no formal LTS-duration or maintenance promise and claims no npm publication, npm dist-tag, or GitHub Release page.
3. Before staging, every path in the complete current non-local candidate inventory receives path-by-path review for intent, secrets/private local configuration, and source/distribution parity; the current audit table covers all 78 current paths. The original human authorization remains for 72 initial pending paths, with `.guarana/web.json` and ignored memory/advisor/install-manifest paths excluded and no ignored file force-added. Because the exact original 72-path manifest was not preserved, no historical mapping from the 78 current paths to those exact 72 is asserted or invented. No unreviewed current candidate path may be staged.
4. `npm run audit`, full `npm test`, `npm run build` with CLI synchronization, `npm run check-cli`, specs validation, and `git diff --check` pass; no retired package/release/OpenCode-host smoke test runs.
5. Fresh independent `worker-verify` returns PASS for the exact release candidate before its single reviewed Conventional Commit is created.
6. The commit is ordinarily pushed to `origin/main`; Node 22.x and 24.x GitHub CI both pass before tag creation; `v1.5.0` is ordinarily pushed and the exact remote commit and matching remote tag are verified.
7. The feature remains TASKED until remote tag proof exists; no npm publication or GitHub Release page occurs without later explicit request.
8. The separately authorized audit fix changes only the two specified canonical lockfiles as independently edited remediation inputs, resolves the vulnerable compatible `body-parser` entry in both to fixed `1.20.9` or another compatible patched version, and has a reviewed diff with no unrelated dependency churn. The required build may update `cli/dashboard/server/package-lock.json` only as a generated mirror, and that mirror must be byte-identical to the canonical `dashboard/server/package-lock.json`. Neither package manifest nor any unrelated dependency version changes; neither canonical lockfile remains vulnerable; the fix is not an audit suppression. `npm ci --prefix dashboard`, `npm ci --prefix dashboard/server`, and `npm run audit` are rerun and pass. A candidate that violates any of these conditions is rejected.

## Candidate path-by-path review — 2026-10-25

Fresh independent read-only `worker-verify` reviewed the complete current candidate inventory below: 78 paths (45 tracked modified/deleted and 33 untracked non-ignored), including source, tests, docs, records, and generated distribution paths. This is a path-level disposition, not final release approval. The original human authorization described 72 initial non-local paths (39 tracked changed/deleted plus 34 untracked, less `.guarana/web.json`), but the exact pre-task 72-path manifest was not preserved. A prior session summary said those paths had been reviewed, but the fresh auditor could not map that claim to a manifest; this record does not fabricate a historical mapping or assert the original 72-path review as proved. `.guarana/web.json` was inspected and excluded (only `{appearance.theme:'dark'}`); ignored `.guarana/memory`, advisor, and install-manifest artifacts were excluded. No actual credential or private local configuration was found; credential-like test values are synthetic `PRIVATE_*`/fake sentinels.

| Current candidate path | Class / disposition | Finding |
|---|---|---|
| `CHANGELOG.md` | Release metadata | Worker-code corrected the omitted validated mandatory progress-reporting requirement; stable-release wording does not establish shipment. |
| `cli/dashboard/server/app.js` | Generated CLI server mirror | Mirrors bounded dashboard server projections; no actual credentials found. |
| `cli/dashboard/server/app.test.js` | Generated CLI test mirror | Synthetic fixtures cover the mirrored app behavior; no actual credentials found. |
| `cli/dashboard/server/lib/telemetry.test.js` | Generated CLI test mirror | Synthetic telemetry fixtures only; no actual credentials found. |
| `cli/dashboard/server/package-lock.json` | Generated lockfile mirror | Generated by build/sync; byte-identical to canonical server lockfile, not a separately authorized remediation input. |
| `cli/dashboard/server/routes/opencode.js` | Generated CLI server mirror | Mirrors bounded OpenCode route projections; no actual credentials found. |
| `cli/dashboard/server/routes/opencode.test.js` | Generated CLI test mirror | Synthetic route fixtures only; no actual credentials found. |
| `cli/dashboard/web/dist/assets/index-5cgVw1lF.js` | Deleted generated distribution asset | DELETED stale hashed JS asset, replaced by current `index-B2kUAIPW.js`. |
| `cli/dashboard/web/dist/assets/index-B2kUAIPW.js` | Generated distribution asset | Current generated CLI bundle; old hashed JS assets are deleted and current output derives from source. |
| `cli/dashboard/web/dist/assets/index-C4l7Azpm.css` | Deleted generated distribution asset | DELETED stale hashed CSS asset, replaced by current `index-DkzXjGIo.css`. |
| `cli/dashboard/web/dist/assets/index-DkzXjGIo.css` | Generated distribution asset | Current generated CLI stylesheet; old hashed CSS assets are deleted and current output derives from source. |
| `cli/dashboard/web/dist/index.html` | Generated distribution entry | Generated CLI entry point; build/sync and bundle parity gates passed. |
| `cli/lib/opencode-model-catalog.js` | CLI source | Uses bounded project `model.list`, exact IDs, and safe errors. |
| `cli/lib/opencode-model-catalog.test.js` | CLI tests | Credential-like values are synthetic test strings only. |
| `cli/main.test.js` | CLI tests | Help-text coverage; no release behavior or actual credentials. |
| `cli/plugin/guarana-telemetry.js` | Generated CLI plugin mirror | Mirrors canonical telemetry plugin; `npm run check-cli` confirms parity. |
| `dashboard/package-lock.json` | Authorized remediation input | Only canonical client lockfile independently edited; `body-parser` 1.20.8→1.20.9 version/URL/integrity metadata only, with no manifest or unrelated package changes. |
| `dashboard/server/app.js` | Dashboard server source | Uses bounded projections; no actual credentials found. |
| `dashboard/server/app.test.js` | Dashboard server tests | Synthetic fixtures only; no actual credentials found. |
| `dashboard/server/lib/telemetry.test.js` | Dashboard server tests | Synthetic telemetry fixtures only; no actual credentials found. |
| `dashboard/server/package-lock.json` | Authorized remediation input | Only canonical server lockfile independently edited; `body-parser` 1.20.8→1.20.9 version/URL/integrity metadata only, with no manifest or unrelated package changes. |
| `dashboard/server/routes/opencode.js` | Dashboard server source | Uses bounded route projections; no actual credentials found. |
| `dashboard/server/routes/opencode.test.js` | Dashboard server tests | Synthetic route fixtures only; no actual credentials found. |
| `dashboard/web/dist/assets/index-5cgVw1lF.js` | Deleted generated distribution asset | DELETED stale hashed JS asset, replaced by current `index-B2kUAIPW.js`. |
| `dashboard/web/dist/assets/index-B2kUAIPW.js` | Generated distribution asset | Current generated canonical bundle; old hashed JS assets are deleted and current output derives from source. |
| `dashboard/web/dist/assets/index-C4l7Azpm.css` | Deleted generated distribution asset | DELETED stale hashed CSS asset, replaced by current `index-DkzXjGIo.css`. |
| `dashboard/web/dist/assets/index-DkzXjGIo.css` | Generated distribution asset | Current generated canonical stylesheet; old hashed CSS assets are deleted and current output derives from source. |
| `dashboard/web/dist/index.html` | Generated distribution entry | Generated canonical entry point; build and CLI synchronization passed. |
| `dashboard/web/src/App.jsx` | Dashboard source | Application shell/routes reviewed; no live deployment or behavior claim. |
| `dashboard/web/src/components/Activity.jsx` | Dashboard source | Activity active/history/privacy UI reviewed against bounded projections. |
| `dashboard/web/src/components/Activity.test.mjs` | Dashboard tests | Synthetic UI/API fixtures; no actual credentials or private local config. |
| `dashboard/web/src/components/CompletedSubagentsModal.jsx` | Dashboard source | Completed-subagent detail UI reviewed; no live execution claim. |
| `dashboard/web/src/components/MemoryGraph.jsx` | Dashboard source | Corrected inaccurate helper copy: only explicit `Focus selected` recenters; copy correction, not behavior change. |
| `dashboard/web/src/components/Memory.test.mjs` | Dashboard tests | Exact helper assertion corrected to “use Focus selected to recenter”; targeted suite passed 14/14 with synthetic data. |
| `dashboard/web/src/components/Models.test.mjs` | Dashboard tests | Synthetic provider/model fixtures; no actual credentials found. |
| `dashboard/web/src/components/Overview.jsx` | Dashboard source | Operational Overview UI reviewed; aggregate/synthetic behavior only, no live deployment claim. |
| `dashboard/web/src/components/Overview.test.mjs` | Dashboard tests | Synthetic fixtures; no actual credentials found. |
| `dashboard/web/src/components/Workflow.test.mjs` | Dashboard tests | Synthetic workflow fixtures; no actual credentials found. |
| `dashboard/web/src/lib/memoryBubbleLayout.js` | Dashboard source | Deterministic Memory layout helper; no external or private data source. |
| `dashboard/web/src/lib/memoryBubbleLayout.test.js` | Dashboard tests | Synthetic layout fixtures only. |
| `dashboard/web/src/style.css` | Dashboard source | Layout/styles reviewed with dashboard source; no data or credential handling. |
| `package.json` | Release metadata | Root package/scripts reviewed as candidate metadata; no package manifest change is authorized for the lock remediation. |
| `plugin/guarana-telemetry.js` | Plugin source | Canonical telemetry implementation; generated CLI mirror parity passed. |
| `plugin/guarana-telemetry.test.mjs` | Plugin tests | Synthetic telemetry values only; no actual credentials found. |
| `plugin/plugin-v2-compat.test.mjs` | Plugin tests | Synthetic compatibility fixtures only; no actual credentials found. |
| `README.md` | Release documentation | Describes intended Stable GitHub/tag delivery, not a completed shipment. |
| `.specs/changes/2026-10-23-dashboard-activity-late-metadata.md` | Change record | Scope/proof record uses sanitized metadata; no credential found. |
| `.specs/changes/2026-10-23-dashboard-activity-setup-boundary.md` | Change record | Bounds lifecycle work to synthetic/source proof and setup boundaries; no deployment claim or credential. |
| `.specs/changes/2026-10-24-dashboard-activity-live-execution-redesign.md` | Change record | Records bounded Activity redesign evidence; no live deployment claim or credential. |
| `.specs/changes/2026-10-24-dashboard-activity-opencode-active-details.md` | Change record | Exact IDs and sanitized projections are bounded; no actual credential found. |
| `.specs/changes/2026-10-24-dashboard-activity-opencode-running-status.md` | Change record | Synthetic/source proof only; no deployment or credential claim. |
| `.specs/changes/2026-10-24-dashboard-memory-index-map-switch.md` | Change record | Memory UI scope is bounded; no live vault data or credential claim. |
| `.specs/changes/2026-10-24-dashboard-memory-map-hide-index-sidebar.md` | Change record | Memory UI scope is bounded; no live vault data or credential claim. |
| `.specs/changes/2026-10-24-dashboard-memory-map-pan-zoom-inspector.md` | Change record | Synthetic browser/source proof only; no live vault data or credential claim. |
| `.specs/changes/2026-10-24-dashboard-memory-map-selection-stability.md` | Change record | Synthetic/source proof only; no live vault data or credential claim. |
| `.specs/changes/2026-10-24-dashboard-overview-operational-workbench.md` | Change record | Synthetic aggregate UI proof only; no live session or credential claim. |
| `.specs/changes/2026-10-24-dashboard-overview-roadmap-bottom-section.md` | Change record | Synthetic/source proof only; no deployment or credential claim. |
| `.specs/changes/2026-10-24-settings-provider-model-catalog.md` | Change record | Exact model IDs and sanitized provider results; no raw auth output or credential retained. |
| `.specs/changes/2026-10-25-advisor-variant-discovery-model-list.md` | Change record | Variant discovery is bounded to exact IDs/source proof; no unproven live behavior or credential claim. |
| `.specs/changes/README.md` | Fixed index | Change index reviewed; no credential or release-completion claim. |
| `.specs/decisions/ADR-040-model-list-variant-discovery.md` | Architecture decision | Bounds model-variant discovery to exact IDs and supplied source proof; no unproven deployment/live browser claim. |
| `.specs/features/dashboard/activity-lifecycle-global-deployment.md` | Feature record | Current scope/proof boundaries reviewed; sanitized metadata, no actual credential found. |
| `.specs/features/dashboard/activity-live-execution-redesign.md` | Feature record | Bounded synthetic/source proof; no live deployment or credential claim. |
| `.specs/features/dashboard/activity-opencode-active-details.md` | Feature record | Exact IDs and bounded projections; no actual credential found. |
| `.specs/features/dashboard/activity-opencode-running-status.md` | Feature record | Bounded source proof; no deployment or credential claim. |
| `.specs/features/dashboard/activity-subagent-lifecycle-telemetry.md` | Feature record | Lifecycle telemetry boundaries and sanitized metadata reviewed; no actual credential found. |
| `.specs/features/dashboard/advisor-variant-discovery.md` | Feature record | Exact model IDs and source proof only; no unproven live behavior claim. |
| `.specs/features/dashboard/memory-index-map-switch.md` | Feature record | Bounded UI proof; no live vault data or credential claim. |
| `.specs/features/dashboard/memory-map-desktop-inspector-stacking.md` | Feature record | Bounded layout proof; no live vault data or credential claim. |
| `.specs/features/dashboard/memory-map-hide-index-sidebar.md` | Feature record | Bounded UI proof; no live vault data or credential claim. |
| `.specs/features/dashboard/memory-map-pan-zoom-inspector.md` | Feature record | Synthetic/source evidence only; no live vault data or credential claim. |
| `.specs/features/dashboard/overview-operational-workbench.md` | Feature record | Synthetic aggregate UI evidence; no live session or credential claim. |
| `.specs/features/dashboard/overview-roadmap-bottom-section.md` | Feature record | Bounded synthetic/source proof; no deployment or credential claim. |
| `.specs/features/dashboard/settings-provider-model-catalog.md` | Feature record | Exact IDs and sanitized results; no actual credentials found. |
| `.specs/features/release/version-bump-1-5-0.md` | Existing release feature | Remains TASKED; its earlier no-edit statement is retained as historical context, with this section recording later verified remediation and local gates. |
| `.specs/README.md` | Fixed tracker | Existing release row's stale remediation proof is replaced by recorder-owned factual audit/gate proof; no validation or shipping claim. |
| `.specs/state/known-issues.md` | Fixed state record | Reviewed with release records; no actual credential/private local configuration found. |
| `.specs/state/project-state.md` | Fixed state record | Stale no-remediation/no-check statements corrected to verified remediation and local gate facts; release remains TASKED. |

The two canonical dashboard lockfiles are the only independently edited remediation inputs. Each diff changes only `body-parser` 1.20.8→1.20.9 version, URL, and integrity metadata; `cli/dashboard/server/package-lock.json` is the generated mirror and byte-matches the canonical server lockfile. No manifest or unrelated dependency version changed. Local gates passed as recorded in the feature Proof. The prior candidate `worker-verify` FAIL remains historical; fresh independent `worker-verify` returned PASS for pre-commit candidate verification on the corrected exact candidate. This candidate PASS is not remote release completion, and release criterion 6 remains unmet pending post-push CI and exact remote tag proof. No commit, push, tag, remote CI, remote tag-date proof, npm publication, or GitHub Release has occurred, and this path-level review is not final release approval.

### Current-candidate audit remediation proof

Both separately authorized canonical lockfiles, `dashboard/package-lock.json` and `dashboard/server/package-lock.json`, resolve `body-parser` 1.20.9. `npm ci --prefix dashboard` and `npm ci --prefix dashboard/server` each passed with zero vulnerabilities; `npm run audit` passed with both workspaces reporting zero vulnerabilities. `cli/dashboard/server/package-lock.json` is only a generated mirror and is byte-identical to the canonical server lockfile; it is not a separately authorized remediation input.

<!-- guarana:record:start -->
Status: TASKED
Proof: Fresh independent worker-verify returned overall pre-commit candidate verification PASS on the corrected exact candidate. The prior candidate FAIL remains historical; this candidate PASS is not shipped, and release criterion 6 remains unmet pending post-push CI and exact remote tag proof.; CHANGELOG.md includes the final update exact changed paths and checks/results requirement, preserving 1.4.0 and [Unreleased]. README Stable/tag intent makes no LTS, npm publication, or GitHub Release completion claim.; The exact current 78-path candidate inventory matches the audit table: 45 tracked modified/deleted plus 33 untracked non-ignored, with no missing or extra rows. The original 72-path historical list is unavailable and no mapping is claimed. .guarana/web.json was excluded as theme-only; ignored artifacts were excluded; no actual credentials/private local config were found, only synthetic test sentinels.; Both canonical lockfiles change only body-parser 1.20.8 to 1.20.9 metadata; manifests are unchanged and the generated CLI server lockfile is byte-identical to its canonical source.; On Node v24.20.0/npm 12.2.0, sequential npm ci --prefix dashboard PASS; npm ci --prefix dashboard/server PASS; npm run audit PASS with zero vulnerabilities; npm test PASS 623/623; npm run build PASS (57 modules plus CLI sync); npm run check-cli PASS.; Initial guarana specs validate /home/arch/codes/Guarana --json PASS (232 Markdown, 90 features, 40 ADRs, 251 links, 0 issues); npm run specs:validate PASS; git diff --check PASS.; npm pack --dry-run --json PASS with 133 entries; LICENSE, CHANGELOG.md, and RELEASING.md are included, no node_modules are included, and the tarball was not executed.; Memory test PASS 14/14; corrected copy says 'use Focus selected to recenter'. Nonfatal npm esbuild install-script, WebSocket port-in-use, Vite reoptimization, and Node module-type warnings occurred; there were no test failures.; No commit, push, tag, remote CI, remote tag-date proof, npm publish/dist-tag, or GitHub Release occurred. Branch main and origin/main remain aligned at f12863b; the index is empty and no local v1.5.0 tag exists. Post-push Node 22/24 CI, exact remote commit/tag, and actual tag-date coherence remain pending.
Change: none
<!-- guarana:record:end -->
