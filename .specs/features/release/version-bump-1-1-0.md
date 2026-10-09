# Feature spec: Guarana 1.1.0 Version Bump

**Status: VALIDATED**

## Goal
Bump package metadata for the backward-compatible specs record CLI while preserving the unpublished release boundary.

## Requirements
- The user authorized a version bump after the file-handoff feature is complete.
- New public CLI functionality warrants the SemVer minor increment 1.0.0 to 1.1.0.

## Assumptions and scope
- Do not publish or create a Git tag.
- The existing 1.0.0 release-candidate evidence remains historical.
- Update root package.json, README version badge/status and CHANGELOG Unreleased notes.
- Refresh project/global Guarana version stamps after metadata change.

## Acceptance criteria
1. Package version and README badge/status reflect local unpublished 1.1.0 and changelog records the specs record/file handoff and worker security changes.
2. CLI --version returns 1.1.0, project/global update outputs current version and 4 worker profiles, status current.
3. Tests, check-cli, specs validator and diff-check pass.
4. This task updates local version metadata only; it does not run `npm publish`, create a Git tag, or push to any remote. At verification time, `npm view guarana@1.1.0 version --json` returns E404.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: worker-verify ses_edea186ddffed36RSeh9eTt7qC — PASS (4/4); node bin/guarana.js --version — 1.1.0; project/global `guarana update` completed 1.0.0 → 1.1.0; four worker profiles refreshed; npm test — PASS (276/276); npm run check-cli — PASS; npm run specs:validate — PASS (134 Markdown, 23 features, 30 ADRs, 208 links); git diff --check — PASS; npm view guarana@1.1.0 version --json — E404; no local 1.1.0/v1.1.0 tag; no publish/tag/push performed by this task
Change: none
<!-- guarana:record:end -->
