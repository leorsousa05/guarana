# Feature spec: Learning-review existing-service authentication

**Status: SHIPPED**

## Goal
Run the post-task learning reviewer through the already-running local OpenCode service without copying credentials or selected global provider configuration, or forwarding provider API-key environment values, while preserving temporary review isolation and deny-all permissions.

## Requirements
- For OpenCode v2.4.1, do not pass --pure: opencode run --help has no --pure option, and a reproduced opencode run --pure exited 1 with Unrecognized flag: --pure.
- Use the existing local OpenCode service discovery path. The v2.4.1 run handler calls ServerConnection.resolve({ autostart: false }), and service discovery reads its registration from XDG_STATE_HOME.
- Expose only the trusted user's XDG_STATE_HOME to the CLI child for service discovery; keep HOME, XDG_CONFIG_HOME, XDG_CACHE_HOME, and XDG_DATA_HOME temporary. Retain the temporary review project and one-step primary reviewer agent with all permissions denied.
- Do not copy auth.json, credentials, databases, or the selected global providerConfig into the temporary project configuration; do not pass selected-provider API-key environment values; do not change credentials or perform additional OAuth/authentication actions.
- Preserve the existing model-selection contract by supplying the selected model ID for the local service to resolve, along with the existing prompt behavior and established prompt, output, timeout, and cleanup constraints.
- Record budgets per ADR-005: worker-code 8k tokens, worker-verify 4k tokens, and a per-run cap of 32k tokens/15 minutes.

## Assumptions and scope
- The installed OpenCode version is v2.4.1, and the supplied CLI behavior and run-handler/service-discovery facts apply.
- The user approved using the already-running local OpenCode service only; no credential or database copying, credential changes, or additional OAuth/authentication actions are approved.
- The current runtime isolates HOME and XDG config/cache/data/state, creates a temporary review project and one-step deny-all primary agent, passes unsupported --pure, copies selected provider auth from auth.json when present, and forwards selected provider environment secrets.
- Primary inspection found memory/learning-review.js writes the entire selected global providerConfig to the temporary project's opencode.json without sanitization; that object may contain credential values.
- The durable runtime contract for post-task learning review through the existing local OpenCode service.
- Focused regression tests for invocation arguments, service-discovery environment isolation, credential/provider-config non-copy and non-forwarding, deny-all reviewer configuration, and existing model/prompt behavior.
- Implementation is integrated in `memory/learning-review.js`, `cli/memory/learning-review.js`, and `plugin/learning-review.test.mjs`. Fresh independent `worker-verify` returned PASS for all eight criteria. No live service or model call occurred during coding or verification. After the runtime refresh, a subsequent `guarana_learning_review` invocation returned `{"status":"no_change","reason":"A decisão e os limites de autenticação já estão documentados na feature e no ADR alterados; uma memória ou skill duplicaria esse registro."}`; this records the tool result, not a successful live model review. No proposal was produced or written.

## Acceptance criteria
1. Focused regression tests prove the OpenCode CLI child receives no --pure argument.
2. Focused regression tests prove the child receives the trusted user's XDG_STATE_HOME for service discovery while HOME, XDG_CONFIG_HOME, XDG_CACHE_HOME, and XDG_DATA_HOME remain temporary and the review project remains temporary.
3. Focused regression tests prove auth.json is not copied and selected-provider API-key environment values are not forwarded to the CLI child.
4. A focused regression proves the temporary project's opencode.json receives neither the selected global providerConfig nor any credential value.
5. Focused regression tests prove the reviewer remains a one-step primary agent with all permissions denied.
6. Focused regression tests prove model selection supplies the selected model ID for the local service to resolve the chosen model, while existing prompt behavior and established prompt, output, timeout, and cleanup constraints remain unchanged.
7. The feature record is VALIDATED only after implementation and independent verification are supplied. The post-refresh `guarana_learning_review` result is reported as `no_change`, not as a successful live model review; no proposal was produced or written without approval.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: Fresh independent worker-verify on exact candidate returned overall PASS (6/6), including learning-review authentication; no live service or model call occurred.; npm test PASS (878/878); npm run build PASS (Vite 6.4.4 and CLI bundle sync); npm run check-cli PASS; npm run specs:validate -- --json PASS (276 scanned, 111 features, 51 ADRs, 307 links, 0 issues); git diff --check PASS.; Source commit ed4fabfe220028756dc71d779814d5201efdede7 was pushed normally (1d59f50..ed4fabf main -> main); git ls-remote origin refs/heads/main exactly matched the commit and the worktree was clean.; GitHub Actions Pages run 45874540342 completed successfully for push SHA ed4fabfe220028756dc71d779814d5201efdede7.; This is source shipment only. Package version bump, tag, npm publication, GitHub Release, and formal package release were not performed.
Change: none
<!-- guarana:record:end -->
