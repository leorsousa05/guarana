# Parallel subtask orchestration — 2026-10-26

Change scope: validate DAG-based parallel read-only research and isolated code subtasks within one primary workflow, including native Task dispatch, dedicated read-only research, per-code-worker worktrees, primary-owned integration, bounded sidecar state, fail-closed locking, and lifecycle/reconciliation behavior. Multiple top-level workflows remain out of scope.

Acceptance summary: fresh independent `worker-verify` returned overall PASS for all eight acceptance criteria. The verifier lacked a historical source fingerprint for comparison; the primary confirms that no source edits occurred after the preceding PASS, only reads and a workflow transition.

Validation results:
- `npm test` — PASS, 700/700.
- Focused deterministic parallel/prompt/workflow/plugin/CLI suite — PASS, 198/198.
- `npm run build` — PASS; Dashboard Vite production build and CLI sync succeeded.
- `npm run check-cli` — PASS; bundle matches canonical sources.
- `node bin/guarana.js specs validate . --json` before this record write — PASS; 249 files, 98 feature specs, 45 ADRs, 282 links, zero issues.
- `git diff --check` — clean.

Deterministic integration proof: an actual `git apply --3way --index` conflict returned non-zero with an unmerged path. The task remained integration-pending, its dependent was not ready, and `code_complete` was rejected.

Deterministic lock proof: a multi-process test confirmed that competing recovery/writer processes cannot delete or reuse the stale lock. `.lock.coord` contention fails closed. A marker left by process death has no automatic recovery; the exact path is surfaced and blind manual deletion is forbidden.

Native Task path-access proof: a real native worker-code Task was assigned `/home/arch/.local/share/opencode/worktree/4e62b0/parallel-task-access-proof` at base `dc154f2e64c2ae8a764a2bcd552d508c1fea56cd`, with commonDir `/home/arch/codes/Guarana/.git`. It reported matching root, commonDir, and HEAD, an empty porcelain status, and successfully read `orchestrator/prompt.js`. This establishes path access for that assignment only; it is not an OS sandbox or a general host guarantee.

Residual limitations: Task-host cancellation remains unavailable/unverified; cancellation is request/reconcile-only. Worktrees mitigate accidental file/index conflicts but are not a malicious-worker security boundary. No provider-backed or OpenCode-host smoke test occurred. No commit, push, release, tag, or npm publication occurred. **Status: VALIDATED, not SHIPPED.**
