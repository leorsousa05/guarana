# Feature spec: Guarana 1.4.0 GitHub-only delivery

**Status: SHIPPED**

## Goal
Deliver every authorized current-tree change to GitHub and confirm ordinary CI, without npm publication or a release tag.

## Requirements
- The full authorized source/spec/policy tree is included in commit 3df50820cc77c5f5152aac74920f66e36dffaddd; the CI-isolation correction is commit 0d7fdee8237b6ccad5a824ada1d72aec6e9e4f6c, pushed normally to origin/main, whose exact main SHA is 0d7fdee8237b6ccad5a824ada1d72aec6e9e4f6c.
- GitHub Actions CI run 39824601849 (https://github.com/leorsousa05/guarana/actions/runs/39824601849) succeeded on Node 22.x and 24.x, with all ordinary gates passing after the XDG test-fixture fix.
- Smoke tests remain prohibited and none ran; script/package/CI smoke entrypoints are removed; .specs/state/known-issues.md is unchanged.
- The user explicitly requested GitHub-only delivery: no npm publication and no v1.4.0 tag were requested or performed. The separate full 1.4.0 npm package release record remains TASKED and is not shipped by this scope.
- Record the current project step and update .specs/README.md NEXT to say GitHub-only delivery is done and the full npm release/tag requires later explicit authorization.

## Assumptions and scope
- GitHub-only delivery of the full authorized current-tree changes and confirmation of ordinary GitHub Actions CI.
- No npm publication, v1.4.0 tag, or smoke test; the separate full package-release record and known-issues record are preserved.

## Acceptance criteria
1. The full authorized source/spec/policy tree is included in commit 3df50820cc77c5f5152aac74920f66e36dffaddd; CI-isolation correction commit 0d7fdee8237b6ccad5a824ada1d72aec6e9e4f6c is pushed normally to origin/main and the exact remote main SHA is 0d7fdee8237b6ccad5a824ada1d72aec6e9e4f6c.
2. GitHub Actions run 39824601849 at https://github.com/leorsousa05/guarana/actions/runs/39824601849 is successful on Node 22.x and 24.x, with all ordinary gates passing after the XDG test-fixture fix.
3. Smoke tests remain prohibited and none ran; smoke script/package/CI entrypoints are removed; .specs/state/known-issues.md remains unchanged.
4. No npm publication or v1.4.0 tag was requested or performed; the separate full 1.4.0 npm package release record remains TASKED and is not marked shipped.
5. .specs/state/project-state.md records GitHub-only delivery as complete, and .specs/README.md NEXT states that GitHub-only delivery is done and full npm release/tag requires later explicit authorization.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: Independent worker-verify PASS for the GitHub-only candidate criteria; separate worker-verify PASS for the XDG test-fixture CI-isolation correction.; Full authorized source/spec/policy tree commit 3df50820cc77c5f5152aac74920f66e36dffaddd and CI-isolation correction commit 0d7fdee8237b6ccad5a824ada1d72aec6e9e4f6c were pushed normally to origin/main; read-only origin/main matched 0d7fdee8237b6ccad5a824ada1d72aec6e9e4f6c immediately after that source/test push.; GitHub Actions CI run 39824601849 (https://github.com/leorsousa05/guarana/actions/runs/39824601849) passed on Node 22.x and 24.x; all ordinary gates passed after the XDG test-fixture fix.; Record-only documentation commit 873ba43daaf3a4b0d18a25b7ef6dc9f88ba2fca0 was pushed normally; read-only origin/main matched it at that checkpoint. CI run 39825721822 on that commit passed both Node 22.x and 24.x matrices and every ordinary step.; Before this record correction, local main and origin/main were both 873ba43daaf3a4b0d18a25b7ef6dc9f88ba2fca0.; Smoke tests remain prohibited by ADR-036 and none ran; smoke script/package/CI entrypoints are removed; .specs/state/known-issues.md is unchanged.; No npm publication or v1.4.0 tag was requested or performed; the separate full 1.4.0 npm package release record remains TASKED.; Newest factual checkpoint: source/test push at 0d7fdee8237b6ccad5a824ada1d72aec6e9e4f6c was followed by record-only commit 873ba43daaf3a4b0d18a25b7ef6dc9f88ba2fca0; read-only origin/main matched each at its respective checkpoint. CI runs 39824601849 and 39825721822 both passed all ordinary gates on Node 22.x and 24.x. The current user scope remains GitHub only: no npm publication or v1.4.0 tag was requested or performed; the full package release remains TASKED. ADR-036 prohibits smoke and none ran; .specs/state/known-issues.md remains unchanged.
Change: none
<!-- guarana:record:end -->
