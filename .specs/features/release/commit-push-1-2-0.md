# Feature spec: Execute authorized Guarana 1.2.0 candidate commit and push

**Status: TASKED**

## Goal
Commit and push the independently validated, unpublished Guarana 1.2.0 candidate to origin/main under the user's explicit authorization, without publishing, tagging, or changing candidate status to SHIPPED.

## Requirements
- The independently validated Guarana 1.2.0 candidate remains VALIDATED; the current task records execution authorization and does not claim execution or shipping.
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
Status: TASKED
Proof: Independent worker-verify corrected overall staged-boundary verdict to PASS: 108 unique candidate paths; staged diff totals 10,169 insertions and 2,250 deletions.; The 108-file candidate remains staged; latest planning updates to .specs/README.md, .specs/state/project-state.md, and .specs/features/release/commit-push-1-2-0.md are unstaged and await final review and staging.; .specs/state/workflow.json remains excluded; archive-0w9fZ3/ remains untracked and excluded; no ignored .guarana/ or node_modules paths were staged.; Previously reviewed staged git diff --cached --check passed.; Branch main at 95eb59c equaled origin/main; no commit or push has occurred. No tag or publish is claimed.; Commit/push run is started; candidate remains VALIDATED, not SHIPPED.; Prior specs validator passed: 158 files, 41 feature specs, 30 ADRs, 205 links, 0 issues.
Change: none
<!-- guarana:record:end -->
