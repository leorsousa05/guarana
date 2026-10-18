# Feature spec: Guarana 1.3.0 release candidate push

**Status: VALIDATED**

## Goal
Prepare and push the complete user-authorized pending work as an unpublished Guarana 1.3.0 candidate, with a consistent minor-version bump and no tag or npm publication.

## Requirements
- The version target is 1.3.0 minor, following ADR-007 and the primary decision for this feature-sized pending work.
- Root package.json, the README badge and status text, and CHANGELOG.md consistently identify 1.3.0 as an unpublished candidate; preserve the historical 1.2.0 candidate entry and describe pending notable changes accurately.
- After required full tests, specs, and package-content checks pass, include all user-authorized pending tracked changes and untracked spec records in one Conventional Commit and push it to origin/main.
- Do not include unrelated ignored or local artifacts or secrets. Do not publish to npm or create a Git tag; a push alone does not mean SHIPPED.
- Keep status TASKED until checks and actual GitHub push evidence exist; record exact commit and remote proof after push, and do not mark SHIPPED without publication or tag confirmation.

## Assumptions and scope
- At planning handoff, main pointed to 9f85cae and matched origin/main, with zero ahead or behind; origin is the GitHub remote https://github.com/leorsousa05/guarana.git and nothing was staged.
- The user authorized pushing all current pending work after choosing Tudo pendente, not only the latest naming change.
- The candidate remains unpublished and untagged unless a separate explicit publication or tag action occurs.
- The pending work spans .specs records, worker-specs naming rule/profile/tests, V1/V2 OpenCode lifecycle event normalization in memory/orchestrator/telemetry plugins with tests and CLI mirrors, and five untracked .specs feature records.
- The release bump covers root package.json, README badge/status text, and CHANGELOG.md; all current user-authorized pending work is intended for the one push.
- This task does not authorize npm publication or a Git tag. The worker-specs record operation must not edit workflow JSON.

## Implementation milestone — version surfaces

The local candidate version surfaces now identify 1.3.0: root `package.json` is 1.3.0, and the README badge and status describe the current local unpublished candidate with the release gate incomplete. `CHANGELOG.md` places the 2026-10-14 unpublished 1.3.0 candidate before an empty `[Unreleased]`, retains the historical 1.2.0 unpublished candidate section, and moves the prior Unreleased entries into 1.3.0. The 1.3.0 entries describe the schema-v1 specs record command and category filename/worker rules; the V2 `data` lifecycle envelope with legacy `properties` compatibility; session-ID lifecycle identity and rejection of event IDs or missing/unknown session IDs; and worker-specs default-deny permissions.

At this milestone, the supplied partial checks passed: `git diff --check`, package version check, changelog section-order check, and empty-Unreleased check. The worker-code version bump touched only `package.json`, `README.md`, and `CHANGELOG.md`. Full tests, CLI/package/spec checks, and independent verification were pending at that point; those gates were later closed by the independent pre-commit PASS recorded below. No commit, push, Git tag, or npm publication has occurred; the candidate remains unpublished.

**Superseded next step from this milestone:** Run full tests and CLI/package/spec checks, obtain independent verification, then commit and push all user-authorized pending changes to `origin/main`. The verification gates are now satisfied by the independent PASS below; commit/push and exact remote evidence remain pending.

## Implementation milestone — Advisor test isolation correction

The user approved a test-only correction to isolate `HOME` and `XDG_CONFIG_HOME` in the Advisor setup-only test without changing product behavior. Worker-code changed only `cli/lib/advisor.test.js`: the test now uses the existing `isolated()` helper, which uses temporary `HOME` and `XDG_CONFIG_HOME`, restores environment and working directory, and cleans up in `finally`. `node --test cli/lib/advisor.test.js` passed 18/18 on the host with global Primary configuration, and `git diff --check` passed. The initial full-suite failure and its diagnosis remain historical; the then-pending rerun is superseded by the independent pre-commit verification below. Candidate remains unpublished; no commit, push, tag, or npm publication has occurred.

**Next:** Commit and push the user-authorized pending work to `origin/main` after the checks recorded below; keep this feature TASKED until exact remote evidence exists. No tag or npm publication is authorized by this record.

## Independent pre-commit verification — 2026-10-14

Fresh independent verification returned **PASS 5/5**. `npm test` passed 466/466 with 0 failures; `npm run check-cli` confirmed the bundle matches; `git diff --check` passed; `guarana specs validate . --json` returned `ok:true` for 180 files and 0 issues; `npm pack --dry-run --json` produced `guarana@1.3.0` with 122 entries and no `node_modules`; and `npm run smoke:pack` passed with 122 files and no `node_modules`. Version surfaces consistently identify 1.3.0 as an unpublished candidate, retain historical 1.2.0, and leave `[Unreleased]` empty.

The first full test run was 465/466 because the setup-only Advisor test inherited host-global Primary settings. With user approval, `cli/lib/advisor.test.js` now uses the existing `isolated()` helper with temporary `HOME` and `XDG_CONFIG_HOME` and restores environment and working directory; the focused test passed and the full suite rerun is green. No product Advisor behavior changed. Git remains on `main`, aligned with `origin/main` (0/0), with no staged files or rename/deletion; no commit or push has occurred. The release remains TASKED and unpublished while commit/push is pending; no tag or npm publication is claimed.

## Acceptance criteria
1. Root package.json, README badge/status text, and CHANGELOG.md consistently identify the 1.3.0 unpublished candidate, preserve the historical 1.2.0 candidate entry, and accurately describe the pending changes.
2. Full tests, specs validation, and package-content checks pass before staging and push.
3. One Conventional Commit contains all user-authorized pending tracked changes and untracked spec records, excludes unrelated ignored/local artifacts and secrets, and is pushed to origin/main only.
4. Independent evidence confirms the exact pushed commit is present on the GitHub origin/main remote; the release candidate remains unpublished and untagged and is not marked SHIPPED.
5. The complete current inventory of 51 tracked modified/deleted paths and 16 untracked paths (67 total, including 10 untracked feature records) is accounted for and reviewed; no approved change is dropped unless a specific secret/security or generated-parity issue requires correction, and any proposed drop is reported first.
6. Review covers secrets and private local configuration and verifies source/distribution mirrors. `npm test`, `npm run test:all` or a documented full-coverage justification, `npm run check-cli`, `guarana specs validate . --json`, `git diff --check`, and applicable dashboard build/sync checks pass before staging; failures are resolved without omitting approved changes.
7. After review and checks, stage all reviewed non-ignored approved checkout changes, commit on `main`, push to `origin/main`, and confirm the exact remote commit. Do not force-add ignored `.opencode`/global profiles or local secrets, and do not claim SHIPPED before remote push confirmation.

## Complete-checkout push planning handoff

The current primary handoff supersedes the earlier inventory snapshot in this record: `git status --short` reports 51 tracked modified/deleted paths plus 16 untracked paths (67 total), including 10 untracked feature records. The user authorized inclusion of every listed path after review. The approved scope spans existing specs/known issues, CLI agents/spec validation, dashboard memory graph/server/UI and generated bundles, memory engine, plugin/orchestrator/telemetry, package metadata, documentation, and tests. No per-path inventory, secret scan, parity check, or new test result is supplied at planning time; none is claimed here. The branch is `main`, tracks `origin/main`, and no commit or push has occurred.

Preserve all approved changes unless review identifies a specific secret/security or generated-parity issue that requires correction; report before dropping any path. Do not force-add ignored `.opencode`/global profiles or local secrets. Review and account for all 67 paths, scan for secrets/private local configuration, verify source/distribution mirrors, and run the checks in acceptance criteria 6. Then stage and commit the reviewed non-ignored approved changes on `main`, push `origin/main`, and verify the remote commit. The feature remains TASKED until validation and actual remote push evidence exist; do not claim SHIPPED before push confirmation.

## Privacy-only documentation milestone — 2026-10-18

Fresh worker-debug amended only the newly added Activity telemetry issue in `.specs/state/known-issues.md`: live child/parent session identifiers were replaced with non-identifying labels, and temporary proof artifacts are marked external to the repository and not retained. No API/session query, capture, test, reload, or product edit occurred. The primary reports `guarana specs validate . --json` PASS (184 files, 0 issues) and `git diff --check` PASS. An earlier scoped scan of added/updated `.specs` hunks found no common credential/private-key patterns; this is not a full checkout security review. Machine-local screenshot/temp paths remain in some added tracker/feature proof text. Do not claim all path references removed, full security review, or shipping.

**Next:** Independent source review and full-checkout security scan, tests, packaging, and source/distribution parity remain pending. After those gates, commit and push the approved work; release remains TASKED until actual remote evidence is recorded.

## Fresh review findings — 2026-10-18

Fresh independent `worker-verify` passed the functional, secret-safety, and canonical-mirror criteria. It found no credentials, local configuration, or live session IDs in changed code/test paths; fixture matches were synthetic only; source/test mirror hashes matched; and the supplied `npm test`, build, CLI check, package, and smoke gates were consistent. A fresh independent documentation verifier passed status/gate review, generated asset/hash parity, and accounting for all 67 paths, but its overall result was **FAIL** on two documentation criteria:

- **Release-description completeness — FAIL:** the 1.3.0 changelog omits notable Memory Graph visualization and relationship management changes (`CHANGELOG.md:65–84`); supporting feature evidence is in `.specs/features/dashboard/memory-graph-visualization.md` and `.specs/features/dashboard/memory-relationship-management.md`.
- **Privacy-path review — FAIL:** machine-local path references occur in newly added or changed prose in `.specs/README.md`, `.specs/state/known-issues.md`, `.specs/features/dashboard/activity-lifecycle-global-deployment.md`, `.specs/features/dashboard/memory-graph-presentation.md`, `.specs/features/dashboard/memory-relationship-management.md`, and `.specs/features/guarana/second-repository-plugin-deduplication.md`. The verifier found no credential or raw live session ID.

The verifier recommends correcting the changelog and sanitizing only the added/changed prose in those paths, followed by fresh independent verification. No tests were run and no edits, staging, commit, or push occurred in this review milestone. The earlier `npm run test:all` result remains 660 passed and 1 mirror-import failure; it is not green. The 1.3.0 release remains TASKED and unpublished; no tag, publication, or SHIPPED result is claimed.

**Next:** The primary resolves the changelog and scoped privacy-path findings, then obtains fresh independent verification and runs any required gates. Keep `test:all`'s prior failure explicit unless a later run changes that result. Do not stage, commit, or push until the findings and required gates are resolved; continue to keep the release TASKED and unpublished until actual remote evidence exists.

## Fresh documentation re-review update — 2026-10-18

Fresh independent `worker-verify` reconfirmed PASS for the 1.3.0 changelog addition and found that the previously flagged changed proof paths were sanitized except for one bare temporary-directory root in the added Memory label-overlap block in `.specs/state/known-issues.md`. Worker-specs replaced that root with `$TMPDIR`, preserving the remainder of the block; this latest edit has not yet been independently verified. The primary reports specs validation PASS (184 files, 0 issues), `git diff --check` PASS, and the inventory remains 51 tracked plus 16 untracked paths. The next gate is a fresh independent `worker-verify` of the exact residual privacy criterion and changelog, followed by the release-level final gate. No test results changed: the prior `npm run test:all` result remains 660 passed and 1 mirror-import failure, not green. No staging, commit, or push occurred. Release remains TASKED; no shipping, tag, or publication is claimed.

## Local commit and push-blocker milestone — 2026-10-18

Worker-code confirmed branch `main` and the initial baseline HEAD/origin/main alignment at `9f85cae5c68d71b682ed50dd269785419d1bade0`. The reviewed inventory was exactly 51 tracked and 16 untracked paths. All 67 approved nonignored paths were staged (45 modified, 6 deleted, 16 added); staged diff-check passed, with no unstaged or untracked remainder. One Conventional Commit was created: `c7cdf36d0e3f4926298cbc34584b1b64ea546e6a` (`feat: expand memory graph and agent tooling`).

Normal `git push origin main` failed with HTTP 403: `Permission to leorsousa05/guarana.git denied to Alerqu1`. No force retry, Git tag, or npm publication occurred. Primary inspection confirms a clean worktree on `main`, HEAD at the commit above, exactly 67 paths in that commit (45 modified, 6 deleted, 16 added), and `origin/main` still at baseline `9f85cae5c68d71b682ed50dd269785419d1bade0`; local `main` is ahead by one commit. Fresh independent `worker-verify` inspection of local commit scope and blocker proof remains pending. Push cannot be completed without authorized GitHub write access. Release remains TASKED, unpublished, and untagged; no remote push or SHIPPED claim is made.

## Fresh independent local-commit verification — 2026-10-18

Fresh independent `worker-verify` **PASSed all four local-commit criteria**. It confirmed branch `main`, HEAD `c7cdf36d0e3f4926298cbc34584b1b64ea546e6a`, subject `feat: expand memory graph and agent tooling`, and parent baseline `9f85cae5c68d71b682ed50dd269785419d1bade0`. The commit diff-tree has no renames and exactly 67 paths (45 modified, 6 deleted, 16 added), matching the approved inventory.

Read-only `git ls-remote origin refs/heads/main` returned baseline `9f85cae5c68d71b682ed50dd269785419d1bade0`; local `main` is one commit ahead. Worker-code's ordinary push failed with HTTP 403 repository write permission denied. No retry or force push occurred. The verifier confirmed no tag points at HEAD. The worktree has only the three expected post-commit `.specs` release-record updates and no untracked paths; specs validation reports 184 files and 0 issues.

The remote push did not occur: preserve the stop reason as missing authorized origin/main write permission. The next step is to obtain authorized write access, then push normally and independently verify the exact remote SHA. The release remains TASKED, unpublished, and untagged; it is not VALIDATED or SHIPPED.

## Authorization update — 2026-10-18

The user explicitly authorized configuring Git's HTTPS authentication to use the active authorized GitHub CLI identity and making one ordinary push retry. `gh auth setup-git` succeeded, and the ordinary `git push origin main` succeeded (`9f85cae..c7cdf36 main -> main`). Fresh independent verification confirmed `origin/main` at `c7cdf36d0e3f4926298cbc34584b1b64ea546e6a`; credential values were not read or exposed. The historical initial HTTP 403 remains recorded above and in known issues. Fresh independent verification of the pushed candidate passed all four criteria; the original candidate implementation SHA remains `c7cdf36d0e3f4926298cbc34584b1b64ea546e6a`. The release is VALIDATED, not SHIPPED. The earlier statement that four intended `.specs` updates still needed a commit and push is superseded by the docs-only closeout below. No force-push, tag, or npm publication occurred.

## Docs-only push closeout — 2026-10-18

The docs-only closeout commit is `b293fbdd7af0e67731d5af53ae74ee4013d087dc` (`docs: record verified 1.3.0 candidate push`) and contains exactly the four reviewed `.specs` files; its staged diff-check passed. Normal push output was `c7cdf36..b293fbd main -> main`. Local HEAD and fresh remote `origin/main` both equal `b293fbdd7af0e67731d5af53ae74ee4013d087dc`; the original candidate implementation commit `c7cdf36d0e3f4926298cbc34584b1b64ea546e6a` remains its ancestor. The primary's read-only check reported a clean worktree, ahead/behind 0/0, specs validation of 184 files with 0 issues, and diff-check pass.

No tag or npm publication occurred; the 1.3.0 candidate remains VALIDATED, not SHIPPED. Historical `npm run test:all` remains 660 passed and one failure, is not green, and was not rerun. No remaining task is required for the candidate push. The primary may commit and push this final docs-only status follow-up if it is nonempty.

## Budget
- Main thread steady-state: at most 8k tokens.
- worker-code: 8k tokens per dispatch; worker-verify: 4k tokens per dispatch; worker-debug: 6k tokens per dispatch.
- Per-run hard cap: 32k tokens and 15 minutes wall-clock per outer-loop rotation, per ADR-005 defaults.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Prior independent worker-verify PASS (4/4) validates the candidate implementation. Candidate implementation commit c7cdf36d0e3f4926298cbc34584b1b64ea546e6a was pushed and is an ancestor of the separately pushed docs-only closeout commit b293fbdd7af0e67731d5af53ae74ee4013d087dc, the previous remote tip.; Current-checkout gates: npm test PASS 488/488 across 55 suites; npm run build and npm run check-cli PASS; npm pack --dry-run --json PASS for guarana@1.3.0 with 122 entries (116 CLI), required README/CHANGELOG/bin/dashboard index and assets, and zero node_modules; npm run smoke:pack PASS with 122.; npm run test:all remains exactly historical FAILED: 660 passed and 1 copied CLI import failure; it is not green and was not rerun. Bounded current-canonical coverage is rationale only, not a test:all pass.; guarana specs validate . --json PASS: 184 files scanned, 0 issues; git diff --check PASS. Fresh verifier criterion 5 found the prior tracker/feature closeout had displaced this current-checkout gate evidence; this record-only correction restores it and adds no new test results. The correction has not yet been independently reverified.; No tag or npm publication occurred; release remains VALIDATED, not SHIPPED. No candidate or prior docs-closeout task remains pending; primary will commit/push this corrective three-record documentation diff after independent verification.
Change: none
<!-- guarana:record:end -->
