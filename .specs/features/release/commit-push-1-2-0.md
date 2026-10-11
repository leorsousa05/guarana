# Feature spec: Execute authorized Guarana 1.2.0 candidate commit and push

**Status: VALIDATED**

## Goal
Commit and push the independently validated, unpublished Guarana 1.2.0 candidate to origin/main under the user's explicit authorization, without publishing, tagging, or changing candidate status to SHIPPED.

## Requirements
- The independently validated Guarana 1.2.0 candidate remains VALIDATED; the authorized commit and push are independently verified, and no shipping is claimed.
- The intended commit contains the candidate CLI refactor and tests, dashboard redesign and tests, generated dashboard bundles, package/release metadata, and relevant human-readable .specs documentation.
- Exclude archive-0w9fZ3/ and .specs/state/workflow.json from the commit; keep ignored .guarana/install-manifest.json and server node_modules excluded.
- The supplied starting facts are branch main and HEAD initially equal to origin/main at 95eb59c.

## Assumptions and scope
- User explicitly authorized commit and push to origin/main.
- No tag, npm publish, or SHIPPED status is authorized by this task.
- Review git status, diff, and the last 10 commits before staging.
- Stage only intended files, inspect the staged diff, and confirm all listed exclusions remain outside the commit.
- Commit with a concise repository-style message, push normally to origin/main, and verify the remote contains the commit.
- Confirm the final worktree is clean apart from the explicitly excluded artifacts.

## Acceptance criteria
1. Before staging, review status, diff, and the last 10 commits against the supplied scope.
2. Only intended files are staged; staged diff review confirms archive-0w9fZ3/, .specs/state/workflow.json, ignored .guarana/install-manifest.json, and server node_modules are excluded.
3. A concise repository-style commit is created and pushed normally to origin/main.
4. Verify origin/main contains the new commit and the final worktree is clean except for the explicitly excluded artifacts.
5. Do not create a Git tag, publish to npm, or change the 1.2.0 candidate from VALIDATED to SHIPPED.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS covers candidate commit 7322e3db322585109fdab08922c6a6d6a733ca38 and docs proof follow-up c3a47723e0882c1297493d1907a8f663ea5fbff1; both were pushed.; Additional docs-only final status record commit b818819be3bc0f4b9ac10d5d02902e6494028847 was pushed; primary confirmed HEAD==origin/main at b818819be3bc0f4b9ac10d5d02902e6494028847. The third documentation commit only persisted a correction/update to the proof records; no independent review of it is claimed.; guarana specs validate . --json PASS: 158 files, 41 feature specs, 30 ADRs, 205 links, 0 issues.; Final worktree contains only modified operational .specs/state/workflow.json and untracked archive-0w9fZ3/; both were excluded from the candidate commit set.; No tag or npm publish occurred; candidate status remains VALIDATED, not SHIPPED.
Change: none
<!-- guarana:record:end -->
