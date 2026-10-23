# Feature spec: Guarana 1.5.0 Version Bump

**Status: TASKED**

## Goal
Prepare the authorized, unpublished local Guarana 1.5.0 candidate for the validated blocker-recovery, atomic workflow kickoff, and progress-reporting feature.

## Requirements
- The user authorized a version bump for the validated [blocker-recovery and atomic-kickoff feature](../orchestrator/blocker-recovery-and-atomic-kickoff.md).
- ADR-007 states feature-sized changes default to a SemVer minor bump; the accepted target is 1.5.0.
- Update package.json, the README version badge/status, and CHANGELOG.md to identify an unpublished local 1.5.0 candidate; preserve historical 1.4.0 and retain [Unreleased].
- The dated 2026-10-22 1.5.0 candidate changelog entry summarizes only validated work: bounded evidence recovery and proportionate verification; atomic workflow_tick(start_task) preserving normal history; and mandatory user-facing phase reports in skill/prompt.
- Refresh the already-installed local global Guarana version stamp after applicable checks; only local profile refresh is allowed.
- Do not publish to npm, create a tag, commit, push, run smoke tests, execute npm pack, run the full suite, or run unrequested E2E. Do not add an ADR; ADR-007 governs the bump.

## Assumptions and scope
- The blocker-recovery and atomic-kickoff feature is already VALIDATED; this version-bump task begins TASKED and has no supplied implementation or verification proof yet.
- The local 1.5.0 version metadata in package.json, README.md, and CHANGELOG.md.
- Refresh the already-installed local global Guarana version stamp after applicable checks.
- Run only the accepted targeted metadata checks, npm run check-cli, guarana specs validate . --json, and git diff --check.
- Do not edit code or installed profiles except the allowed local global version-stamp/profile refresh; do not perform publication, tagging, commit, push, smoke, package execution, full-suite, or unrequested E2E actions.

## Acceptance criteria
1. Version surfaces consistently identify 1.5.0 as an unpublished candidate; CHANGELOG preserves 1.4.0 and [Unreleased] and includes only the supplied validated changes.
2. node bin/guarana.js --version and global guarana --version report 1.5.0 after metadata/install refresh; the global installed stamp is 1.5.0.
3. Targeted metadata checks, npm run check-cli, guarana specs validate . --json, and git diff --check pass; no broad, smoke, or release action runs.
4. No publication, tag, commit, or push occurs.

<!-- guarana:record:start -->
Status: TASKED
Proof: none
Change: none
<!-- guarana:record:end -->
