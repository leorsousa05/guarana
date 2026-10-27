# Feature spec: Dashboard current-parallel-subtasks source candidate

**Status: TASKED**

## Goal
Prepare the already-validated Dashboard current-parallel-subtasks feature as an unpublished, untagged Guarana 1.5.2 source candidate and, after all acceptance gates pass, push it normally to `origin/main`.

## Requirements
- The user said “Pode subir” and, after clarification, explicitly chose the patch bump to 1.5.2. This authorizes only the bounded source-candidate delivery in this spec.
- Reuse the existing VALIDATED Dashboard implementation record at `.specs/features/dashboard/current-parallel-subtasks.md` and its existing six-criterion proof; do not fold this distinct delivery task into that implementation checkpoint.
- Update only necessary candidate version surfaces: root `package.json`, root `README.md` badge/current-candidate prose, and a dated `CHANGELOG.md` candidate entry. Candidate wording must identify 1.5.2 as unpublished and untagged, retain `[Unreleased]`, preserve the stable 1.5.0 instructions and historical 1.5.1 candidate facts, and describe only the validated current-parallel-subtasks behavior.
- Candidate path scope is the validated feature's source, Specs records, and canonical plus generated CLI/Dashboard assets, together with the necessary 1.5.2 candidate metadata and records. Review every staged path; exclude unrelated, ignored, and local-private content.
- Before any source commit or push, require full `npm test`, Dashboard build plus CLI sync, `check-cli`, Specs validation, `git diff --check`, package-content dry-run inventory only, and a fresh independent `worker-verify` PASS. Do not run any retired smoke test or actual `npm publish`.
- Use one normal Conventional Commit on current `main` and a normal push to `origin/main`; never force-push. Confirm the exact source commit SHA on the remote before recording shipment. After confirmation, update this source-delivery record and the necessary change/overview/tracker/project-state records with exact commit and remote proof, mark this source-delivery task SHIPPED, and validate after the record write. If the Specs closeout is separately committed and pushed, confirm `origin/main` equals final closeout HEAD.
- No Git tag, npm publication or dist-tag, GitHub Release page, or package release is authorized. Keep package/release smoke gates retired. No change receipt is created before the new candidate gates pass.
- ADR-046 remains unchanged and is the existing architectural decision for the Dashboard projection. This reversible patch-version selection requires no new architectural ADR.

## Assumptions and scope
- This is a distinct source-candidate delivery task; the Dashboard current-parallel-subtasks implementation remains separately VALIDATED and not SHIPPED at this planning checkpoint.
- The supplied target is `/home/arch/codes/Guarana`, branch `main`, HEAD `a742d7cf7459ba1a0f006ba54e309180505b8dda`; supplied `origin/main` advertised the same SHA. No files are staged. Version/release files are unmodified. The worktree is intentionally dirty with the validated feature implementation/docs and existing planning Specs.
- The source candidate and source push are the entire delivery boundary. A source push does not imply a Git tag, npm publication/dist-tag, GitHub Release, formal package release, or smoke-test authorization.
- Budget (ADR-005 defaults): main-thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, and worker-debug 6k per dispatch; per-run hard cap 32k tokens and 15 minutes.
- References: validated implementation `.specs/features/dashboard/current-parallel-subtasks.md`; projection contract [ADR-046](../../decisions/ADR-046-dashboard-parallel-subtask-projection.md).

## Acceptance criteria
1. Before any version/source edit, this authorization and scope record exists. Root `package.json` says `1.5.2`; README badge/current-candidate prose and a dated CHANGELOG candidate entry consistently describe an unpublished, untagged 1.5.2 source candidate. `[Unreleased]`, stable 1.5.0 instructions, and historical 1.5.1 candidate facts remain. The candidate describes only the validated Dashboard current-parallel-subtasks behavior and makes no publication, tag, or formal-release claim.
2. Every staged candidate path is reviewed and accounted for. The candidate contains only the validated Dashboard feature's source, Specs records, CLI/Dashboard generated assets, and necessary 1.5.2 candidate metadata/records; no unrelated, ignored, or local-private content is included.
3. Before source commit/push, full `npm test`, Dashboard build and CLI sync, `check-cli`, Specs validation, `git diff --check`, package-content dry-run inventory, and fresh independent `worker-verify` all pass. The package inventory is inspection only; no retired smoke test or actual `npm publish` runs.
4. The candidate is committed with a Conventional Commit on current `main` and pushed normally to `origin/main`, with no force push. Read-only remote-ref confirmation proves `origin/main` equals the exact source commit SHA before any source SHIPPED claim or shipment-record update.
5. After exact remote confirmation, this source-delivery record is marked SHIPPED with exact commit/remote proof, necessary change/overview/tracker/project-state records are closed out, and Specs validation passes after the record write. If record-only closeout changes are separately committed/pushed, remote `origin/main` is confirmed to equal final closeout HEAD.
6. No Git tag, npm publication/dist-tag, GitHub Release page, formal package release action, retired smoke test, or force push occurs.

<!-- guarana:record:start -->
Status: TASKED
Proof: none
Change: none
<!-- guarana:record:end -->
