# ADR-049 — Learning-review service authentication

**Status:** Accepted (2026-11-26) · implementation TASKED · append-only

## Context

OpenCode v2.4.1 `opencode run --help` has no `--pure` option, and a reproduced
`opencode run --pure` exits 1 with `Unrecognized flag: --pure`. The v2.4.1 run
handler calls `ServerConnection.resolve({ autostart: false })`; service
discovery reads its registration from `XDG_STATE_HOME`.

The current Guarana reviewer uses a temporary HOME and XDG config/cache/data/
state roots, a temporary review project, and a one-step primary agent with all
permissions denied. It also passes the unsupported flag, copies selected
provider authentication from `auth.json` when present, and forwards selected
provider environment secrets. The user approved use of the already-running
local OpenCode service, but did not approve credential or database copying,
credential changes, or additional OAuth/authentication actions.

## Decision

Use OpenCode's existing local-service discovery for the post-task learning
review. Do not pass `--pure`. Expose the trusted user's `XDG_STATE_HOME` to the
CLI child so OpenCode can discover the existing service; keep `HOME`,
`XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, and `XDG_DATA_HOME` temporary. Retain the
temporary review project and the one-step primary reviewer agent with all
permissions denied.

Do not copy `auth.json` or pass selected-provider API-key environment values
to the CLI child. Do not copy credentials or databases, alter credentials, or
perform additional OAuth/authentication actions. Preserve the existing model
selection and prompt behavior, along with established prompt, output, timeout,
and cleanup constraints.

Implementation and focused regression tests are pending in the
[learning-review service authentication feature](../features/cli/learning-review-service-authentication.md).
This decision does not claim that a live model review succeeded.

## Alternatives considered

- Pass `--pure` to isolate the reviewer — rejected because OpenCode v2.4.1
  does not recognize the flag.
- Copy `auth.json` or forward provider API-key environment values — rejected;
  that is not the user-approved route. Use the already-running local service
  instead.

## Consequences

The CLI child must receive the user's service-registration state home while
other isolated roots remain temporary. Credential-file copying and provider
API-key forwarding are excluded. Focused implementation tests and independent
verification remain pending.

## Addendum — Provider configuration remains service-owned (2026-11-26)

Primary inspection found that `memory/learning-review.js` writes the entire
selected global `providerConfig` into the temporary project's `opencode.json`
without sanitization; the object may contain credential values. Do not write
the selected global provider configuration or credential values into that
temporary project. The already-running local OpenCode service owns its provider
configuration and authentication.

Preserve model selection by supplying the selected model ID; the service
resolves the chosen model through that ID. A focused regression must prove the
temporary project's `opencode.json` receives no selected global provider
configuration or credential value, and must preserve the selected-model-ID
behavior. Implementation and verification remain pending.

## Implementation and independent verification closeout — 2026-11-26

**VALIDATED, not SHIPPED.** Implementation is integrated in
`memory/learning-review.js`, `cli/memory/learning-review.js`, and
`plugin/learning-review.test.mjs`. Fresh independent `worker-verify` returned
PASS for all eight criteria, including trusted-state fallback/rejection,
non-forwarding of secrets, model/prompt behavior, output-overflow and timeout
reasons with cleanup, and temporary-root cleanup on success. It independently
ran the focused tests (18/18), `npm run check-cli`, `git diff --check`, source/
mirror `cmp`, and Specs validation (272 files scanned, 0 issues); all passed.
Worker-code and primary integration checks also passed the focused tests,
`npm run check-cli`, `git diff --check`, and `cmp`.

The primary `npm test` run reported 876/878. The two failures reproduced with
`node --test cli/commands/install.test.js` at tests on lines 58 and 90; the
unrelated `cli/commands/install.js` and `cli/commands/install.test.js` are
clean/unmodified. The full suite is not claimed as passing.

No live service or model call occurred during coding or verification; no
credentials changed, and no commit or release occurred.

## Addendum — Post-fix learning-review result (2026-11-26)

The first post-fix `guarana_learning_review` tool call returned
`{"status":"unavailable","reason":"opencode_exit_1"}`. Read-only diagnosis found
that the global plugin wrapper was current but the sibling global runtime
helper `/home/arch/.config/opencode/memory/learning-review.js` was stale: it
still contained unsupported `--pure` and old auth-copy code. The exact child
stderr was not observed, so no specific child error is asserted.

A mistakenly invoked `node bin/guarana.js plugin install --help` ran the full
global install. Afterward, plugin status reported the learning-review runtime
installed and up to date, and `cmp` showed it byte-identical to canonical. A
later explicit `node bin/guarana.js plugin install` also ran the full install;
current global plugin status is fully current. Neither invocation is described
as plugins-only. No auth, provider, credential, or credential-file change
occurred.

After runtime refresh, the primary called `guarana_learning_review` again. Its
exact result was
`{"status":"no_change","reason":"A decisão e os limites de autenticação já estão documentados na feature e no ADR alterados; uma memória ou skill duplicaria esse registro."}`.
No proposal was produced or written. This tool result is distinct from the
independent code-verifier PASS and does not assert a successful live model
review. The validated code proof remains independent worker-verify PASS (8/8),
focused tests 18/18, `npm run check-cli`, `git diff --check`, and source/mirror
`cmp` PASS. `npm test` reported 876/878; the two reproduced failures are
unrelated `cli/commands/install.test.js` tests at lines 58 and 90, with the
implementation and test files clean and unmodified. The full suite is not
claimed as passing. No commit or release occurred.
