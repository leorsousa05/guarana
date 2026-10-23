# Feature spec: Native workflow_tick caller-identity guard

**Status: VALIDATED**

## Goal
Make native workflow_tick fail closed when caller identity is incomplete so a missing identity cannot persist a project-shared workflow transition.

## Requirements
- In plugin/guarana-orchestrator.js, workflow_tick.execute(args, context = {}) currently rejects only when isWorkerContext(context.sessionID, context.agent) is true; missing sessionID or agent bypasses that guard and may persist a project-shared transition.
- Reject native workflow_tick before transition evaluation or persistence when either context.sessionID or context.agent is absent, while preserving the existing rejection for recognized worker contexts.
- Update primary-path tests to pass explicit primary identity context instead of relying on omitted context; add regression tests for missing identity and recognized worker identity that prove the workflow file is unchanged on rejection.
- Keep plugin/guarana-orchestrator.js and cli/plugin/guarana-orchestrator.js synchronized. Generated worker profiles deny workflow_tick, but the native guard remains required.
- The V2 adapter forwards received context to the native callback (plugin/guarana-orchestrator.js:745-757); no external adapter implementation was found in this repository. The reported external unknown action: start_task mismatch remains unexplained and outside this fix.

## Assumptions and scope
- Bounded follow-up to .specs/features/orchestrator/subagent-dispatch.md; preserve that record and its historical proof.
- Native workflow_tick caller-identity checks, primary-path test contexts, rejection/no-workflow-file-mutation regression tests, and canonical/CLI plugin parity.
- Do not modify an external adapter, attempt to restore workflow state, or perform any version or release action. The separate unpublished 1.5.0 candidate and 1.4.1 GitHub-only plan remain out of scope.
- Use ADR-005 default budgets: worker-code 8k tokens and worker-verify 4k tokens per dispatch; 32k-token per-run cap and 15 minutes.

## Acceptance criteria
1. Native workflow_tick rejects a call before transition evaluation or persistence when context.sessionID is missing or context.agent is missing; tests exercise each missing-identity case and prove the workflow file is unchanged after either rejection.
2. A recognized worker context continues to be rejected, and a regression test proves the workflow file is unchanged after that rejection.
3. Primary-path workflow_tick tests supply explicit primary sessionID and agent identity rather than relying on context omission; valid primary transition behavior remains covered.
4. The canonical and CLI plugin artifacts are synchronized, with the repository's parity check passing.
5. The record states that the V2 adapter forwards context, no external adapter implementation was found, and the external unknown action: start_task mismatch is unexplained and out of scope; it does not claim an adapter fix.

## Final independent verification — 2026-10-22
Fresh independent `worker-verify` returned overall PASS for all five acceptance criteria. `plugin/guarana-orchestrator.js:524–529` and `cli/plugin/guarana-orchestrator.js:524–529` reject absent, non-string, empty, or whitespace-only `sessionID`/`agent` before worker checks or workflow evaluation; the existing recognized-worker rejection remains. `plugin/guarana-orchestrator.test.mjs:155–183` exercises undefined/missing/empty/whitespace identity and recognized-worker rejection for canonical and bundled plugin instances, comparing Buffers to prove the workflow file remains byte-for-byte unchanged after each rejection. `node --test plugin/guarana-orchestrator.test.mjs plugin/plugin-v2-compat.test.mjs` passed 47/47; successful primary calls use explicit context, no successful direct no-context call remains, and child isolation remains covered at test lines 629–749. `node scripts/check-cli-bundle.mjs` passed with “CLI bundle matches canonical sources.” `git diff --check` exited 0 with no output.

Read-only cached/worktree diff review found pre-existing staged memory-hardening changes, unstaged atomic-kickoff work, and a separate unpublished 1.5.0 candidate. The guard changes are worktree-only; nothing was staged or cleaned. The current snapshot cannot independently establish historical attribution beyond the supplied pre-change baseline. External adapter code remains absent; no adapter behavior or live runtime fix is claimed. No release/version action occurred. The separate unpublished 1.5.0 and 1.4.1 GitHub-only delivery notes remain outside this guard task; no shipment is claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS for all five acceptance criteria.; plugin/guarana-orchestrator.js:524–529 and cli/plugin/guarana-orchestrator.js:524–529 reject absent, non-string, empty, or whitespace-only sessionID/agent before worker check or workflow evaluation; the existing worker rejection remains.; plugin/guarana-orchestrator.test.mjs:155–183 covers undefined/missing/empty/whitespace identity and recognized-worker rejection for canonical and bundled plugin instances; Buffer comparisons prove the workflow file is byte-for-byte unchanged after every rejection.; node --test plugin/guarana-orchestrator.test.mjs plugin/plugin-v2-compat.test.mjs passed 47/47; successful primary calls now pass explicit context, no successful direct no-context call remains, and child isolation remains covered at test lines 629–749.; node scripts/check-cli-bundle.mjs passed: CLI bundle matches canonical sources.; git diff --check exited 0 with no output.; Read-only cached/worktree diff review found pre-existing staged memory-hardening changes, unstaged atomic-kickoff work, and a separate unpublished 1.5.0 candidate. Guard changes are worktree-only; nothing was staged or cleaned. Current snapshot cannot independently establish historical attribution beyond the supplied pre-change baseline.; External adapter code remains absent; no adapter behavior or live runtime fix is claimed. No release/version action occurred; no shipment is claimed.; Before this record update, specs validation passed 204 files, 78 feature specs, 38 ADRs, 229 links, and 0 issues.
Change: none
<!-- guarana:record:end -->
