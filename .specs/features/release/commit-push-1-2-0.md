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
Proof: Independent worker-verify corrected verdict: PASS.; HEAD and origin/main both resolve to 7322e3db322585109fdab08922c6a6d6a733ca38 (feat(guarana): redesign dashboard and refactor CLI).; git diff-tree --no-commit-id --name-only -r HEAD lists 108 changed paths; none match .specs/state/workflow.json, .guarana/, archive-0w9fZ3/, or node_modules.; .specs/state/workflow.json and .guarana/advisor.json exist unchanged from HEAD^; their presence in the full tree is inherited and not a violation. Archive and node_modules are absent from the changed set.; No 1.2.0 tag; npm view guarana@1.2.0 version --json returned E404.; Specs validation returned ok:true, 158 files, 0 issues.; Commit/push task is COMPLETE and VALIDATED, not SHIPPED. Post-commit task record edits in .specs/README.md, .specs/state/project-state.md, and .specs/features/release/commit-push-1-2-0.md have not been pushed; no tag or npm publish occurred.
Change: none
<!-- guarana:record:end -->
