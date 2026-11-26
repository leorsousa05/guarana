# Feature spec: Guarana checkout source-candidate delivery

**Status: VALIDATED**

## Goal
Record the bounded Guarana 1.5.4 unpublished, untagged source candidate dated 2026-11-26, distinguishing candidate validation from the later authorized commit, push, and shipping closeout.

## Requirements
- Candidate is an unpublished, untagged Guarana 1.5.4 source candidate dated 2026-11-26, based on `3defde479fd8b65d5e8577f60532ba66eff6108d`.
- The candidate contains only these five paths: `.specs/README.md`, `.specs/features/release/checkout-source-candidate-delivery.md`, `CHANGELOG.md`, `README.md`, and `package.json`. The two included product changes are already committed in the base: Dashboard reintroduction and the restricted/scoped worker-specs record-write permission fix. Candidate-only metadata and Specs records are additive; unrelated pre-existing primary-checkout changes are excluded.
- Package version is 1.5.4. README badge/prose and dated changelog identify an unpublished, untagged source candidate; the changelog places Dashboard under Added and the permission fix under Fixed. Keep top-level [Unreleased] empty, preserve historical 1.5.3 changelog content, and preserve stable 1.5.0 instructions.
- Candidate gates passed: `npm ci --prefix dashboard`, `npm test`, `npm run build`, `npm run check-cli`, `npm run specs:validate -- --json`, `git diff --check`, and `npm pack --dry-run --json` as inventory only with no tarball. Proof details are recorded below.
- A fresh independent worker-verify PASS for the corrected criteria has been received and recorded; status is VALIDATED. Commit or push only after that PASS; shipment closeout remains pending.
- After that fresh PASS, the authorized next action is a normal Conventional Commit containing exactly the five candidate paths, followed by a normal push to `origin/main`; verify `git ls-remote origin refs/heads/main` equals the exact pushed SHA before marking SHIPPED and recording factual closeout.
- Do not create a tag, npm publication or dist-tag, GitHub Release, formal package release, force-push, or run retired smoke tests.

## Assumptions and scope
- The primary Specs target is `/home/arch/Projects/active/guarana`, branch `main`, at HEAD `3defde479fd8b65d5e8577f60532ba66eff6108d`, with `main...origin/main`. The independent candidate validation worktree used the same HEAD and had exactly the five candidate paths modified and unstaged, with no staged paths or untracked files.
- The candidate's only product changes are the committed Dashboard reintroduction and restricted/scoped worker-specs write permission fix. No uncommitted primary-worktree changes are included.
- Use the existing ADR-005 budget defaults: main-thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, and worker-debug 6k per dispatch; per-run hard cap 32k tokens and 15 minutes.
- This is a bounded source-candidate delivery, not a package publication or formal release. No ADR is required.

## Acceptance criteria
1. The 1.5.4 candidate is based on `3defde479fd8b65d5e8577f60532ba66eff6108d` and contains exactly `.specs/README.md`, `.specs/features/release/checkout-source-candidate-delivery.md`, `CHANGELOG.md`, `README.md`, and `package.json`; unrelated primary-checkout changes are excluded.
2. Package, README, and dated CHANGELOG metadata consistently identify version 1.5.4 dated 2026-11-26 as unpublished and untagged; Dashboard is under Added and the scoped worker-specs permission fix under Fixed; top-level [Unreleased] is empty, historical 1.5.3 content is preserved, and stable 1.5.0 instructions remain.
3. The only product changes attributed to this candidate are the two already committed base changes: Dashboard reintroduction and restricted/scoped worker-specs record-write permissions. Candidate-only metadata and Specs records are additive.
4. The recorded candidate gates pass: `npm ci --prefix dashboard`, `npm test`, `npm run build`, `npm run check-cli`, `npm run specs:validate -- --json`, `git diff --check`, and inventory-only `npm pack --dry-run --json` with no tarball. A fresh independent worker-verify PASS for these corrected criteria has been received and recorded. Commit or push only after that PASS; shipment closeout remains pending.
5. After that PASS, create a normal Conventional Commit containing exactly the five candidate paths, push normally to `origin/main`, and verify `git ls-remote origin refs/heads/main` equals the exact pushed SHA before recording SHIPPED status and closeout.
6. No tag, npm publication or dist-tag, GitHub Release, formal package release, force-push, or retired smoke test occurs.
7. The labeled historical 1.5.3 recorder receipt remains verbatim.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify returned overall PASS for all seven corrected 1.5.4 pre-commit candidate criteria; evidence: /tmp/opencode/guarana-1.5.4-gates.ZoHF7x. The verifier confirmed exact five-path scope, corrected feature text, metadata, base product changes (Dashboard restoration ancestor 0052845 and worker-specs permission fix 3defde4), required gates, no prohibited actions, and the historical 1.5.3 receipt identical at 1,152 characters. Specs validation PASS: 272 files, 109 features, 49 ADRs, 306 links, 0 issues; check-cli and diff-check PASS; npm pack dry-run inventory: 145 files, required docs present, no node_modules and no tarball. npm test PASS 865/865 with scratch HOME/XDG; build PASS with 62 modules and CLI sync; npm ci --prefix dashboard exited 0 with 142 packages and 2 moderate advisories. Candidate is not committed or pushed; shipment closeout remains pending. No remote SHA or external tag/publication state is claimed.
Change: none
<!-- guarana:record:end -->

## Historical 1.5.3 recorder receipt (preserved)

Status: SHIPPED
Proof: Source commit 00f427b03bcbca837686bc84ae259cd6efe02918 (chore(release): prepare Guarana 1.5.3 source candidate), parent 0ae04b37041fee8e48c919212cbbf0ce344a9cda. Normal push to https://github.com/leorsousa05/guarana.git reported 0ae04b3..00f427b main -> main. Immediately after push, git ls-remote origin refs/heads/main returned exactly 00f427b03bcbca837686bc84ae259cd6efe02918, equal to local HEAD; checkout was clean.; Fresh independent worker-verify gate before push: overall PASS, criteria 1–5, for the exact candidate. npm run build PASS; npm test PASS (628/628); npm run check-cli PASS; Specs validation PASS (263 files, 103 features, 48 ADRs, 302 links, 0 issues); both diff checks PASS. npm pack --dry-run --json was inventory-only for guarana@1.5.3: 105 files, LICENSE/CHANGELOG.md/RELEASING.md included, no node_modules, and no tarball.; Local and remote candidate tags were absent; GitHub releases API was empty; npm view guarana@1.5.3 returned E404. No tag, npm publication or dist-tag, GitHub Release, formal release, force push, or retired smoke was performed. Source remains unpublished and untagged.
Change: none

## 1.5.4 source candidate plan (2026-11-26)

### Goal
Prepare an unpublished, untagged Guarana 1.5.4 source candidate. This is not a formal package release.

### Requirements and scope
- The authorized candidate metadata identifies version 1.5.4 dated 2026-11-26 as an unpublished, untagged source candidate.
- Move the currently committed loopback-only Dashboard reintroduction from CHANGELOG `[Unreleased]` into the dated 1.5.4 entry, and list the worker-specs scoped record-write permission fix under `Fixed`.
- Preserve historical 1.5.3 content and stable 1.5.0 instructions.
- Edit only release metadata and necessary Specs records for this candidate. Do not include or attribute any unrelated pre-existing worktree modifications.
- If all gates and independent verification pass, the candidate is committed and pushed normally to `main`. Do not create a tag, formal package release, npm publication or dist-tag, GitHub Release, or run the retired smoke test.

### Baseline and assumptions
- Repository is `/home/arch/Projects/active/guarana`, branch `main`, HEAD `3defde4` (`fix(agents): allow scoped worker-specs record writes`); `origin/main` was synchronized to this SHA after push.
- Root package and README currently identify source candidate 1.5.3. The loopback-only Dashboard reintroduction is committed in CHANGELOG `[Unreleased]` by `0052845`; the worker-specs permission fix is committed by `3defde4`.
- The current checkout has unrelated pre-existing user modifications. They are excluded; candidate gates run from a clean checkout.

### Acceptance criteria
1. Before any version, README, or CHANGELOG edit, this feature record is TASKED and `.specs/README.md` contains a distinct `Guarana 1.5.4 source candidate delivery` tracker row with blank proof/change fields; the 1.5.3 SHIPPED row and its historical proof remain intact.
2. Package/README release metadata identifies 1.5.4 dated 2026-11-26 as an unpublished, untagged source candidate. The dated CHANGELOG 1.5.4 entry contains the Dashboard item moved out of `[Unreleased]` and the worker-specs permission fix under `Fixed`; historical 1.5.3 content, `[Unreleased]`, and stable 1.5.0 instructions are preserved.
3. Only candidate release metadata and necessary Specs records are included; unrelated pre-existing worktree modifications are neither included nor attributed to the candidate.
4. From a clean checkout, `npm ci --prefix dashboard`, `npm test`, `npm run build`, `npm run check-cli`, `npm run specs:validate -- --json`, `git diff --check`, and `npm pack --dry-run --json` (inventory only) pass. A fresh independent verification passes for the exact candidate before normal commit/push.
5. No tag, formal package release, npm publication or dist-tag, GitHub Release, or retired smoke test occurs.
