# Feature spec: Retire Guarana package and release smoke tests

**Status: VALIDATED**

## Goal
Retire all Guarana package, release, and OpenCode-host smoke tests while preserving ordinary release checks and historical evidence.

## Requirements
- Remove scripts/smoke-packed-cli.mjs, the root package smoke:pack script, and its CI invocation.
- Remove packed CLI lifecycle/dashboard-startup smoke and latest-stable OpenCode-host smoke from the release checklist.
- Maintained policy explicitly says smoke tests are retired and MUST NOT be run or reintroduced as development, CI, or release gates.
- Preserve ordinary unit/integration tests, build, CLI parity, specs validation, and npm pack --dry-run --json package-content inspection; do not treat package inventory inspection as a smoke test.
- Preserve historical smoke results/transcripts unchanged and leave .specs/state/known-issues.md unchanged.
- Do not perform release actions, version bump, tag, publication, commit, or push.

## Assumptions and scope
- Retirement policy and release checklist alignment.
- Removal of the packed CLI smoke entrypoint, package script, and CI invocation by the separately dispatched implementation worker.
- Preservation of historical smoke evidence and all non-smoke release checks.

## Acceptance criteria
1. scripts/smoke-packed-cli.mjs, the root smoke:pack script, and its CI invocation are absent; the release checklist contains no packed CLI lifecycle/dashboard-startup or latest-stable OpenCode-host smoke instruction.
2. Maintained policy records state that package/release/OpenCode-host smoke tests are retired and MUST NOT be run or reintroduced as development, CI, or release gates.
3. Ordinary unit/integration tests, build, CLI parity, specs validation, and npm pack --dry-run --json package-content inspection remain; the package inspection does not install or execute the tarball and is not called a smoke test.
4. Historical smoke results and transcripts remain unchanged, and .specs/state/known-issues.md remains unchanged.
5. No release operation, version bump, tag, publication, commit, or push is performed or authorized by this task.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify details: criterion 1 PASS (script/package/CI smoke entrypoints removed); criteria 2 and 3 initially FAIL because stale future-facing smoke instructions remain in the CLI refactor plan and automatic-skill-creation feature; criterion 4 PASS (historical evidence and known-issues unchanged).; Structural specs validation PASS: 197 files, 73 features, 36 ADRs, 215 links, zero issues; git diff --check PASS. No tests, build, smoke, npm pack, install, or release ran in the independent verification. package.json was already version 1.4.0 before this dispatch; no version or release metadata change is attributed to this task.; Fresh independent worker-verify now confirms smoke-retirement criteria 1–4 PASS. The earlier criterion 2 and 3 FAIL findings remain historical and are superseded by corrected active prose; historical receipts remain historical evidence. .specs/state/known-issues.md is unchanged.; No release operation, version bump, tag, publication, commit, or push occurred during the smoke-retirement task. The candidate remains uncommitted and no SHIPPED claim is made.
Change: none
<!-- guarana:record:end -->
