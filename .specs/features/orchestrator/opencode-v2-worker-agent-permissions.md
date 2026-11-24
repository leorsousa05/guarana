# Feature spec: OpenCode V2 worker-agent permissions

**Status: SHIPPED**

## Goal
Record the OpenCode V2 worker-agent permissions subfeature as shipped independently from its validated implementation parent.

## Requirements
- Every generated worker-agent profile uses an OpenCode V2 permissions list of ordered action/resource/effect rules; no generated profile uses legacy permission:.
- Preserve role-specific behavior. worker-specs uses default-deny edits and permits only project-root-relative .specs/README.md, .specs/state/*.md, .specs/features/*.md, and .specs/changes/*.md; do not add broad absolute-prefix permissions.
- Worker dispatch guidance runs from the target repository root and uses project-root-relative paths for the existing narrow allowlist.
- Tests cover generated project and global profile scopes, V2 frontmatter, and allowed and forbidden edit paths.
- Do not modify the installed/customized global worker-specs profile.

## Assumptions and scope
- Generated worker-agent profiles, worker-specs edit permissions, repo-root dispatch guidance, and their tests.
- The exact OpenCode V2 implementation validation and source shipment in Guarana 1.5.3 candidate commit 00f427b03bcbca837686bc84ae259cd6efe02918.
- Source shipment only; no tag, npm publication or dist-tag, GitHub Release, or formal package release.
- ADR-005 budget defaults: main thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, worker-debug 6k per dispatch; per-run cap 32k tokens and 15 minutes.

## Acceptance criteria
1. All five generated worker-agent profiles use V2 ordered action/resource/effect permission rules and none uses legacy permission:.
2. Role-specific behavior is preserved, including worker-specs default-deny edits and exactly the existing project-root-relative .specs/README.md, .specs/state/*.md, .specs/features/*.md, and .specs/changes/*.md grants, with no broad absolute-prefix permission.
3. Tests assert V2 frontmatter and allowed and forbidden edit-path cases for generated project and global profile scopes.
4. Canonical and CLI worker dispatch instructions run from the target repository root and use root-relative paths for the existing narrow .specs allowlist.
5. The installed/customized global worker-specs profile remains byte-unchanged.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: Fresh implementation worker-verify returned overall PASS for criteria 1–5. It confirmed V2 ordered permissions for all five profiles; worker-specs default-deny with exactly .specs/README.md, .specs/state/*.md, .specs/features/*.md, and .specs/changes/*.md edit grants; denials for architecture, conventions, decisions, handoff JSON, neighboring, unlisted, traversal, absolute, and foreign paths; only the two fixed shell recorder commands; canonical/CLI repo-root dispatch guidance; generated and installed project/global policy tests; and no global profile change.; Implementation checks: focused agents tests 4/4 PASS; prompt tests 52/52 PASS; npm run check-cli PASS; git diff --check PASS; implementation-time Specs validation PASS (261 files, 302 links, 0 issues); primary npm test PASS (623/623). The final 1.5.3 candidate npm test passed 628/628.; Source commit 00f427b03bcbca837686bc84ae259cd6efe02918 (chore(release): prepare Guarana 1.5.3 source candidate), parent 0ae04b37041fee8e48c919212cbbf0ce344a9cda, was pushed normally to https://github.com/leorsousa05/guarana.git; push output was 0ae04b3..00f427b main -> main. Immediately after push, git ls-remote origin refs/heads/main returned exactly 00f427b03bcbca837686bc84ae259cd6efe02918, equal to local HEAD, and checkout was clean. The final candidate worker-verify gate passed overall, criteria 1–5.; Candidate gates: npm run build PASS; npm test PASS (628/628); npm run check-cli PASS; Specs validation PASS (263 files, 103 features, 48 ADRs, 302 links, 0 issues); both diff checks PASS; npm pack --dry-run --json was inventory-only for guarana@1.5.3 (105 files, LICENSE/CHANGELOG.md/RELEASING.md included, no node_modules, no tarball). No tag, npm publication or dist-tag, GitHub Release, formal package release, force push, or retired smoke occurred; source remains unpublished and untagged.
Change: none
<!-- guarana:record:end -->
