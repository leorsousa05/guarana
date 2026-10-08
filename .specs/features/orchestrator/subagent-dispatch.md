# Feature spec: native Task worker dispatch

**Status:** VALIDATED
**Date:** 2026-10-07

## Goal

Make the existing `worker-code`, `worker-verify`, and failure-only
`worker-debug` contracts execute as real OpenCode Task subagents with separate
contexts, while retaining the Guarana plugin as the workflow-state router and
active-skill injector.

## Decision and boundaries

- Use OpenCode's native Task tool from the primary model; the plugin does not
  call a private server/session API.
- Install named subagent profiles in `.opencode/agents/` for projects and
  `~/.config/opencode/agents/` globally.
- Build each worker's prompt from the corresponding canonical `SKILL.md` at
  install time so each procedure has one maintained source.
- Preserve the parent workflow state machine. The primary agent dispatches and
  waits; only the primary advances workflow state after receiving the worker
  contract.
- Identify Task child sessions from OpenCode session metadata and keep them out
  of the parent workflow: child prompts do not re-plan or receive the parent's
  orchestration injection, child tool failures do not trigger parent debugging,
  and `workflow_tick` rejects child calls.
- When current global and project plugin instances receive the same parent user
  message, process that message once so a duplicated hook cannot skip workflow
  phases.
- Worker-code may implement the assigned condition. Worker-verify is read-only
  for repository files while allowed to inspect and run checks. Worker-debug
  diagnoses failures and records known issues, but does not implement code.
- When Task dispatch is unavailable or denied, report the block and keep the
  workflow from claiming worker completion; same-context implementation is not
  an acceptable fallback.
- Protect foreign agent files on install/update/uninstall and remove only
  Guarana-owned profiles/prompts.

## Acceptance criteria

1. OpenCode recognizes the three profiles as hidden subagents; each generated
   prompt contains its current canonical worker skill and matching return
   contract.
2. Project and global install deploy the profiles to OpenCode's documented
   agent roots; uninstall removes only Guarana-owned artifacts and refuses to
   overwrite or delete foreign files.
3. The always-on prompt and `guarana:build` require Task dispatch for code and
   independent verification, route `worker-debug` only after a failure, pass
   exact condition/budget/state pointers, wait for returns, and keep workflow
   transitions in the primary context. Child-session activity leaves parent
   state, prompt injection, and verification routing unchanged; child
   `workflow_tick` is refused.
4. Tests prove the code/verify role and permission split, debug failure gate,
   prompt generation from canonical skill bodies, child-session isolation,
   duplicate-hook idempotency, project/global paths, foreign-file protection,
   and CLI bundle parity.
5. A provider-backed `opencode run` smoke captures actual Task tool calls and
   distinct child sessions for worker-code and worker-verify; a failure-path
   scenario demonstrates worker-debug only after verification fails.
6. Full tests, production build, `check-cli`, and specs validation pass; exact
   outcomes and smoke evidence are recorded before validation.

## Status

Implemented. Independent verification and final proof record are pending.

## Implementation and validation evidence

- `node --test plugin/guarana-orchestrator.test.mjs cli/lib/agents.test.js` — PASS, 25 tests (including plugin lifecycle and worker-profile tests).
- `node --test orchestrator/workflow.test.js` — PASS, 35/35.
- `node --test cli/commands/plugin.test.js cli/lib/agents.test.js` — PASS, 6/6.
- `node --test cli/orchestrator/workflow.test.js cli/orchestrator/prompt.test.js` — PASS, 35/35.
- OpenCode `agent list` in a temporary project install — PASS; output listed `worker-code (subagent)`, `worker-verify (subagent)`, and `worker-debug (subagent)`.
- `node --test cli/lib/agents.test.js cli/commands/plugin.test.js` — PASS, six named tests cover project/global installation roots, foreign-name refusal/preservation, profile health, and managed cleanup; exact names/results are in the JSONL smoke evidence.
- `npm test` — PASS, 213/213 tests across 43 suites.
- `npm run build` — PASS; Vite 6.4.3 transformed 51 modules and built in 1.34s; generated assets and CLI bundle synchronized from canonical sources.
- `npm run check-cli` — PASS; exact output: `CLI bundle matches canonical sources.`
- `npm run specs:validate` — PASS; 107 Markdown files, 16 feature specs, 20 ADRs, and 157 local links after the final proof/index links.

### OpenCode Task smoke transcript

Command:

```sh
HOME=/tmp/opencode/guarana-clean-home.8NVaMM XDG_DATA_HOME=/home/arch/.local/share opencode run --model openai/gpt-6-luna --format json 'Create a repository-root file named task-output.txt with exactly these ASCII bytes: TASK_WORKER_OK. Do not add a trailing newline. After implementation, independently verify that the file contains exactly 14 bytes and no other content.'
```

Observed Task child returns:

```text
worker-code session ses_ee78a56acffeIhlLsZeTb64Pqq:
Created repository-root task-output.txt with the requested TASK_WORKER_OK content and no added newline.
Stop reason: condition-met.

worker-verify session ses_ee789d74affeKo5qbAuJog9Y57:
Specs validation: ok=true, issues=[].
Byte check: exists=True, length=14, hex=5441534b5f574f524b45525f4f4b,
exact_ascii_match=True, length_is_14=True.
Criterion verdicts: PASS; overall verdict PASS.
```

The Task tool metadata gave each child a separate `sessionId` and the same
`parentSessionId`. The persisted parent history was exactly
`new_task → plan_complete → run_start → code_complete → verify_pass`; it did
not re-plan on child messages.

Structured extracts from the captured OpenCode JSON stream retain the actual
`tool_use`/`task` name, call IDs, subagent arguments, parent/child session IDs,
and returned output in [subagent-dispatch-smoke.jsonl](subagent-dispatch-smoke.jsonl).

### Failure-path Task smoke transcript

Command:

```sh
opencode run --pure --format json 'Run an isolated Task failure-path smoke with strict role separation. First call worker-code: create .specs/state/known-issues.md containing the header # Known Issues and actual.txt containing exactly actual; return diff, condition, stop_reason; budget 8k. Then call worker-verify in a distinct child session: verify whether actual.txt equals expected exactly; expected is intentionally absent. Run a real byte-level check, return FAIL evidence and proof; budget 4k. Only after the verifier returns FAIL, call worker-debug with the full failure result; classify using its matrix, append a title/symptom/reproduction/mitigation/status entry to .specs/state/known-issues.md, and return root cause/fix; budget 6k. If verification passes, do not call debug. The primary only orchestrates Task calls and does not edit the files.'
```

Observed Task results:

```text
worker-code: created the isolated fixture; stop_reason=condition-met.
worker-verify: FAIL; expected is absent; actual.txt has 6 bytes 61 63 74 75 61 6c.
worker-debug: unclassified; recorded title, symptom, reproduction, mitigation,
and unclassified status in .specs/state/known-issues.md.
```

The three results were returned by distinct Task session IDs. Debug ran only
after the verifier returned FAIL. Its file-scoped edit permission was verified
by the successful append in this run.
- Prose/architecture rationale: worker profiles are generated at installation from the canonical `code`, `verify`, and `debug` skill bodies; no procedures are copied into a second maintained source. The primary prompt delegates worker states and suppresses those worker bodies in primary context. Plugin hooks identify child sessions and deduplicate parent message processing; tests cover these boundaries.
- Independent worker-verify review — PASS, all six criteria; exact verdict and evidence are retained in the final workflow event and command results. It specifically verified the raw-shaped Task call records, discovered profile names, install/permission tests, child-state guard, and all command outputs.

### Captured validation command outputs

The independent verification run captured the following exact command outcomes
before issuing its verdict:

```text
$ npm test
exit: 0
ℹ tests 213
ℹ suites 43
ℹ pass 213
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

```text
$ npm run build
exit: 0
vite v6.4.3 building for production...
transforming...
✓ 51 modules transformed.
rendering chunks...
dist/index.html                   0.73 kB │ gzip:  0.41 kB
dist/assets/index-BYV5-X1l.css   31.65 kB │ gzip:  6.35 kB
dist/assets/index-3skno4Mu.js   245.89 kB │ gzip: 76.96 kB
✓ built in 2.03s
synced skills/guarana -> cli/skills/guarana
synced plugin/guarana-telemetry.js -> cli/plugin/guarana-telemetry.js
synced plugin/guarana-memory.js -> cli/plugin/guarana-memory.js
synced plugin/guarana-orchestrator.js -> cli/plugin/guarana-orchestrator.js
synced orchestrator -> cli/orchestrator
synced dashboard/server -> cli/dashboard/server
synced dashboard/web/dist -> cli/dashboard/web/dist
synced memory -> cli/memory
synced skill-engine -> cli/skill-engine
CLI bundle is in sync.
```

```text
$ npm run check-cli
exit: 0
CLI bundle matches canonical sources.
```

```text
$ npm run specs:validate
exit: 0
Validating specs: /home/arch/codes/Guarana/.specs
107 Markdown file(s), 16 feature spec(s), 20 ADR(s), 156 local link(s)
PASS: specs structure and local references are consistent.
```

```text
$ git diff --check
exit: 0
(no output)
```

```text
$ opencode agent list  (clean temporary HOME; project-installed profiles)
exit: 0
worker-code (subagent)
worker-verify (subagent)
worker-debug (subagent)
```
