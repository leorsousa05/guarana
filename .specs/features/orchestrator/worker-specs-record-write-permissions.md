# Feature spec: Worker-specs record-write permissions

**Status: VALIDATED**

## Goal

Record the validated narrow permission additions needed for `worker-specs` to use its fixed handoff, create direct domain feature Markdown, and append ADRs without broadening its default-deny policy.

## Requirements

- Retain edit deny-by-default and the established grants `.specs/README.md`, `.specs/state/*.md`, `.specs/features/*.md`, and `.specs/changes/*.md`.
- Add exactly `.specs/state/worker-specs-handoff.json`, `.specs/features/*/*.md`, and `.specs/decisions/ADR-*.md` as edit resources.
- Preserve shell deny-by-default with only the two existing fixed specs recorder commands allowed.
- Match `*` to one path segment; bare `*` continues to match any resource. Test allowed and denied paths for project and global generated profiles.
- Refresh managed global artifacts with the full install command, without changing auth, provider, or credential files.

## Assumptions and scope

- The permission implementation and matcher tests are limited to `cli/lib/agents.js` and `cli/lib/agents.test.js`.
- This is a permission-policy and human-readable Specs follow-up; it does not alter the fixed recorder contract.
- The previously shipped [OpenCode V2 worker-agent permissions record](opencode-v2-worker-agent-permissions.md) remains intact. Its exact grant list is historical; the additional narrow grants recorded here and in [ADR-050](../../decisions/ADR-050-worker-specs-record-write-permissions.md) supersede that list as the current policy.
- The full global install refreshed the managed plugins, memory/orchestrator/skill engines, and worker/primary/advisor artifacts. No auth, provider, or credential files changed.
- No commit, release, or shipping is claimed.
- Budget: worker-specs 4k tokens per dispatch; worker-verify 4k; primary at most 8k; per-run cap 32k tokens and 15 minutes, following ADR-005.

## Acceptance criteria

1. Generated `worker-specs` profiles preserve edit deny-by-default and the prior grants, adding exactly `.specs/state/worker-specs-handoff.json`, `.specs/features/*/*.md`, and `.specs/decisions/ADR-*.md`.
2. Shell remains denied except for `guarana specs record --file .specs/state/worker-specs-handoff.json` and `node bin/guarana.js specs record --file .specs/state/worker-specs-handoff.json`.
3. Unit tests prove single-segment `*` matching and bare-`*` behavior, and exercise allowed and denied paths for project and global generated profiles.
4. Fresh independent `worker-verify` returns PASS for all five criteria; `node --test cli/lib/agents.test.js` passes 4/4, `npm run check-cli` passes, and `git diff --check` passes.
5. After `node bin/guarana.js plugin install`, global plugin status reports worker-specs and all listed managed artifacts up to date. No credential change, full `npm test` result, commit, release, or shipping is asserted.

## Validation proof

- Fresh independent `worker-verify` returned PASS for all five criteria.
- `node --test cli/lib/agents.test.js` passed 4/4; `npm run check-cli` and `git diff --check` passed.
- Only source/test changes were `cli/lib/agents.js` and `cli/lib/agents.test.js`. The matcher now treats `*` as one path segment while bare `*` remains any resource; tests cover allowed and denied paths for generated project and global profiles.
- The full global install was `node bin/guarana.js plugin install`, not a plugins-only install. Beforeward, only worker-specs showed stale/foreign; afterward, plugin status reports worker-specs and all listed managed artifacts up to date.
- No auth, provider, or credential files changed. No full `npm test`, commit, release, or shipping is claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify PASS for all five criteria.; `node --test cli/lib/agents.test.js` PASS (4/4); `npm run check-cli` PASS; `git diff --check` PASS.; Only source/test changes were cli/lib/agents.js and cli/lib/agents.test.js.; The exact full global install command `node bin/guarana.js plugin install` refreshed managed plugins, memory/orchestrator/skill engines, and worker/primary/advisor artifacts; before install only worker-specs was stale/foreign, and afterward plugin status reports worker-specs and all listed managed artifacts up to date.; No auth, provider, or credential files changed; no full npm test, commit, release, or shipping is claimed.
Change: none
<!-- guarana:record:end -->
