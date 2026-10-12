# Feature spec: Reusable skill playbooks, safe updates, and dashboard skill consolidation

**Status: SHIPPED**

## Goal
Shift automatic skill capture toward reusable domain-level playbooks, safely extend existing Guarana-generated skills, and consolidate this project's narrow dashboard skills.

## Requirements
- The injected capture policy must inspect skill_list and prefer extending a semantically fitting existing macro skill. Create a new skill only for a distinct reusable domain or workflow, not merely a screen, route, or task detail; one task may qualify only when it reveals a durable, broad procedure.
- Add a skill_update tool that updates only an existing Guarana-generated skill in the requested scope, verifies identity and scope, and requires the caller-provided `expectedRevision` from `skill_list`; the revision is a SHA-256 digest derived from the exact bytes of the existing `SKILL.md`, so any byte change invalidates it even if the filesystem mtime is restored.
- The model-facing plugin `skill_list` must include a revision per skill. The shared engine list defaults to omitting revisions and has an opt-in flag; only the plugin opts in, so the `/api/skills` response remains exactly unchanged.
- `skill_update` must preserve existing name, description, content, size, secret, generated-identity, and scope checks, and preserve same-directory atomic temporary replacement. Manual skills and stale files remain untouched.
- Keep skill-list and dashboard response shapes unchanged and make no dashboard UI/API contract changes.
- Consolidate .opencode/skills/dashboard-memory-view/SKILL.md and .opencode/skills/dashboard-skills-registry/SKILL.md into conditional feature-specific sections in .opencode/skills/dashboard-change-process/SKILL.md, preserving unique details, then remove the two standalone files. Leave other skills untouched.
- Test engine and plugin update/refusal cases and macro-versus-micro capture policy; preserve canonical/CLI mirrors with npm run sync-cli and npm run check-cli.

## Assumptions and scope
- The optimistic-concurrency token is a SHA-256 revision of the exact existing `SKILL.md` bytes; mtime is not part of revision identity.
- The shared skill-engine list omits revisions by default; only the model-facing plugin opts in to include them.
- Only Guarana-marked skill files may be updated.
- No dashboard UI/API contract changes are in scope.
- Do not alter global or manual skills or other project skill documents.
- Do not change the /api/skills response shape.
- Initial independent verification failed criterion 2 because a restored mtime allowed a stale token; this historical result is superseded by the final independent verification milestone below.

## Planning milestone (pre-code)

Requirements and acceptance criteria were finalized for this task. The pre-code `guarana specs validate . --json` result was PASS (`ok: true`, 163 files, 46 feature specs, 30 ADRs, 205 links, 0 issues). This validates `.specs` structure only; no implementation or acceptance proof was recorded at that planning milestone.

## Implementation milestone (worker-code report; not independent acceptance)

Worker-code reports a macro-first capture policy and a `skill_update` tool with Guarana-generated skill identity/scope checks, caller-provided `expectedUpdatedAt`, existing content security validation, and atomic temporary-file replacement. Engine/plugin tests and tool-policy coverage were updated.

Worker-code reports consolidating the unique guidance from `.opencode/skills/dashboard-memory-view/SKILL.md` and `.opencode/skills/dashboard-skills-registry/SKILL.md` into conditional feature-specific sections in `.opencode/skills/dashboard-change-process/SKILL.md`, then removing only the two standalone documents. Reported canonical/mirrored code paths: `plugin/guarana-memory.js`, `plugin/guarana-memory.test.mjs`, `skill-engine/index.js`, `skill-engine/index.test.js`, `cli/plugin/guarana-memory.js`, `cli/skill-engine/index.js`, and `cli/skill-engine/index.test.js`.

Worker-code reports focused tests PASS (18/18; exact command not supplied), `npm run sync-cli` PASS, `npm run check-cli` PASS, and `git diff --check` PASS. The `.opencode/` files are ignored by Git; the reported documentation update and removals were made on disk and may not appear in Git status/diff. No independent verification or acceptance result is supplied or claimed; this milestone is IMPLEMENTED, not VALIDATED.

## Initial independent verification milestone (2026-10-12; superseded by final PASS below)

Independent verification FAILED overall. The verifier passed criteria 1, 3, and 5, and failed criterion 2. In `skill-engine/index.js:179-200`, filesystem `mtimeMs` is used as `expectedUpdatedAt`; the verifier changed the file body, restored the original mtime, and the stale token was accepted. Exact verifier output: `{"token":1700000000125,"beforeUpdate":1700000000125,"staleTokenAccepted":true,"result":{"updated":true,"name":"stable-guide","description":"Updated guide.","scope":"project"}}`.

The verifier reports criterion 4's current dashboard merge/content checks pass, with a verification limitation: other ignored `.opencode` files could not be independently compared to a VCS baseline. Reported checks: full `npm test` 447/447; `check-cli` PASS; specs validation 163 files, 0 issues. No overall acceptance claim is made. Status remains IMPLEMENTED, not VALIDATED or SHIPPED.

## Debug milestone before the revision fix (2026-10-12; superseded by final PASS below)

`worker-debug` classified criterion 2 as an unclassified stale-version/concurrency defect. The `expectedUpdatedAt` token is derived from filesystem `mtimeMs`, so changing file content and restoring its original mtime can reuse the old token and allow a stale update. The exact reproduction and output are recorded in `.specs/state/known-issues.md`. No code fix has been applied. The overall independent verification remains FAILED at criterion 2; status remains IMPLEMENTED, not VALIDATED or SHIPPED. Criterion 4's current dashboard checks passed, but independent comparison of other ignored `.opencode` files against a VCS baseline remains limited.

Next step at this checkpoint: request independent re-verification of the SHA-256 content-revision fix reported in the implementation milestone below; preserve the ignored `.opencode` baseline limitation in its evidence. This checkpoint was superseded by the final verification below.

## Post-verification implementation decision (2026-10-12)

- Replace `expectedUpdatedAt` with a SHA-256 revision of the exact existing `SKILL.md` bytes. The model-facing plugin `skill_list` returns this revision per skill; the shared engine list omits it by default and provides an opt-in flag used only by the plugin. The `/api/skills` response must remain exactly unchanged.
- `skill_update` requires the listed `expectedRevision` and rejects when any byte has changed since listing, including when the original filesystem mtime has been restored. Preserve the existing generated identity/scope/content checks and same-directory atomic temporary replacement.
- Add a regression that mutates the body, restores the exact mtime, proves the old revision is rejected, and confirms the newer content remains untouched; a valid update using the newer revision must succeed.
- This is a design decision, not implementation or proof. No fix or independent re-verification is supplied. Status remains IMPLEMENTED and verification remains FAILED at criterion 2; no VALIDATED or SHIPPED claim is made.

## Revision fix implementation milestone (worker-code report; independent verification pending)

Worker-code reports replacing mtime tokens with SHA-256 revisions of exact `SKILL.md` bytes. Revisions are exposed by the model-facing plugin `skill_list` only; shared engine/API default listings remain unchanged. The dashboard API test asserts the revision does not leak.

Worker-code reports a body-change plus exact-mtime-restore regression that rejects the old revision without overwriting the newer content, while an update using the current revision succeeds. Reported canonical files: `skill-engine/index.js`, `skill-engine/index.test.js`, `plugin/guarana-memory.js`, `plugin/guarana-memory.test.mjs`, and `dashboard/server/app.test.js`. Reported synchronized mirrors: `cli/skill-engine/index.js`, `cli/skill-engine/index.test.js`, `cli/plugin/guarana-memory.js`, and `cli/dashboard/server/app.test.js`.

Worker-code reports focused tests PASS (41/41; exact command not supplied), `npm run sync-cli` PASS, `npm run check-cli` PASS, and `git diff --check` PASS. These are implementation evidence only; independent re-verification remains pending. Status is IMPLEMENTED, not VALIDATED or SHIPPED.

## Final independent verification milestone (2026-10-12)

Independent `worker-verify` returned an overall AND verdict PASS for all five verifier criteria. This final result supersedes the earlier criterion-2 failure and the pending status recorded above.

1. Macro-first policy/list/update/create behavior passed; references: `plugin/guarana-memory.js:20-40,220-263` and assertions in `plugin/guarana-memory.test.mjs:53-83`.
2. Exact-byte SHA-256 revisions reject a stale update after a body change even when the original mtime is restored, preserve the newer bytes, and allow an update with the current revision. Existing identity/scope/manual/input/security guards are retained; same-directory temporary-file plus rename atomic replacement was inspected at `skill-engine/index.js:152-222`; regression coverage is at `skill-engine/index.test.js:87-218`.
3. Revision output is opt-in to the engine and plugin only. `/api/skills` default output remains unchanged and the endpoint test proves there is no revision field; references: `dashboard/server/lib/skills.js:21-25` and `dashboard/server/app.test.js:290-319`.
4. The merged dashboard guide preserves Memory/Skills registry contracts, the narrow skill directories are empty, and unrelated generated entries remain present with their prior `updatedAt` values unchanged. Limitation: `.gitignore:30` ignores `.opencode/`, and `git ls-files -- .opencode/skills` has no tracked baseline, so exact historical content of unrelated ignored skill files cannot be established. The verifier assessed this as a non-blocking limitation; it is not represented as proof of an exact historical baseline.
5. Canonical/CLI parity passed.

Independent checks: `npm test` exited 0 with 447 passed and 0 failed across 53 suites (the WebSocket port 24678 warning was nonfatal); `npm run check-cli` passed; `git diff --check` exited 0; `guarana specs validate . --json` exited 0 with 163 files, 46 feature specs, 30 ADRs, 205 links, and 0 issues. No commit or push occurred. Status is VALIDATED, not SHIPPED; shipping was not confirmed.

## Acceptance criteria
1. Verify injected capture behavior and skill_update tool registration: the policy inspects skill_list, prefers a semantically fitting macro skill, creates a new skill only for a distinct reusable domain/workflow rather than screen/route/task detail, and allows a single task only when it establishes a durable broad procedure. Focused tests distinguish macro from micro cases.
2. Verify the model-facing plugin `skill_list` returns a SHA-256 revision of each exact existing `SKILL.md`; the shared engine list omits revisions by default and exposes them only through an opt-in flag used by the plugin. Verify `skill_update` requires the listed `expectedRevision`, only updates an existing Guarana-generated skill in the matching requested scope and identity, and rejects stale revisions—including a body change followed by restoration of the original mtime—and manual-skill attempts without modifying their files.
3. Verify accepted updates use the existing name, description, content, size, secret, generated-identity, and scope checks and same-directory atomic temporary replacement. The regression must prove that body mutation plus exact mtime restoration causes rejection of the old revision and leaves the changed content untouched, while a valid update using the newer revision succeeds; refusal paths leave files unchanged.
4. Verify the existing `/api/skills` response shape remains exactly unchanged and no dashboard UI/API contract changes are introduced.
5. Verify the two specified dashboard skills are consolidated into conditional feature-specific sections in dashboard-change-process with each source's unique reusable details preserved, both standalone files removed, and all other skills untouched.
6. Verify canonical and CLI skill/plugin mirrors are synchronized by npm run sync-cli and npm run check-cli.
7. Verify focused policy/engine/plugin tests (including the restored-mtime revision regression), the full npm test suite, and applicable build checks pass; record exact commands and outcomes only after they are run.
8. Verify .specs validation passes after recording the implementation and proof; record pre-code structural validation separately and do not claim implementation or acceptance validation during this planning milestone.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: Independent worker-verify overall AND verdict PASS for all five verifier criteria.; Criterion 1 macro-first policy/list/update/create behavior verified in plugin/guarana-memory.js:20-40,220-263 and assertions in plugin/guarana-memory.test.mjs:53-83.; Criterion 2 exact-byte SHA-256 revision rejects stale update after body change plus restored original mtime, preserves newer bytes, accepts current revision, and retains identity/scope/manual/input/security guards; atomic same-directory temp plus rename inspected at skill-engine/index.js:152-222; regression at skill-engine/index.test.js:87-218.; Criterion 3 revision is opt-in to engine and plugin only; /api/skills default output unchanged and endpoint test proves no revision at dashboard/server/lib/skills.js:21-25 and dashboard/server/app.test.js:290-319.; Criterion 4 merged dashboard guide preserves Memory/Skills registry contracts; narrow skill directories are empty; unrelated generated entries remain with unchanged prior updatedAt values. Limitation: .gitignore:30 ignores .opencode/ and git ls-files -- .opencode/skills has no tracked baseline, so exact historical content of unrelated ignored skill files cannot be established; verifier assessed this as non-blocking.; Criterion 5 canonical/CLI parity passed.; npm test exited 0 with 447 passed and 0 failed across 53 suites; nonfatal WebSocket port 24678 warning. npm run check-cli passed; git diff --check exited 0; guarana specs validate . --json exited 0 with 163 files, 46 feature specs, 30 ADRs, 205 links, and 0 issues.; Independent transport verification PASS: commit 9c5be8a55a84a4e29751e2f55cf4ef7caa795658 is on local main, origin/main, and live remote refs/heads/main; 13 committed paths match intended scope and no committed path is under .opencode/. The tracked and untracked worktree was clean before this record update.; Exact ordinary push command rtk git push returned cb83e0c..9c5be8a main -> main; ok main.; Limitation: .opencode/ remains intentionally ignored/local; ignored skill files were not pushed.; No release, tag, or npm publish was requested or performed.
Change: none
<!-- guarana:record:end -->
