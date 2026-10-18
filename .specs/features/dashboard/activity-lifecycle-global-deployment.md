# Feature spec: Dashboard Activity lifecycle global deployment follow-up

**Status: TASKED**

## Goal
Deploy the validated Activity subagent lifecycle fix to the user-authorized global OpenCode plugin scope and record live runtime behavior after reload, without changing profiles or unrelated/project artifacts.

## Requirements
- Use only `guarana plugin install --plugins-only` to update the three stale global Guarana plugins and bundled engines; preserve worker/advisor profiles.
- Reload OpenCode after the global update and verify live runtime behavior in Activity.
- Observe a real child Task session with its correct parent session, child session, and agent identity; record observed busy/running followed by idle/terminal history.
- Do not emit evt_* event IDs as session IDs or create sessions for lifecycle events without session identity.
- Do not capture or expose prompts, outputs, hidden reasoning, or task titles in telemetry or Activity output.
- Keep the source Activity lifecycle code feature VALIDATED; this deployment follow-up is TASKED and is not a shipping claim.

## Assumptions and scope
- The user explicitly authorized global update and reload, acknowledging that other projects are affected.
- `guarana plugin status` shows only the three global Guarana plugins stale.
- The `plugin install --plugins-only` preflight confirms all three installed plugin files match managed manifest hashes and plans no worker/advisor profile writes.
- The project `.opencode/plugins` directory is empty.
- A mistaken `guarana plugin install --help` invocation reached normal full-install preflight and was refused because global `worker-specs.md` is stale/foreign; no mutation occurred. Do not retry the full-install path.
- Budgets follow ADR-005 defaults; no override was supplied.
- Global plugin-only installation/update and bundled engines, OpenCode reload, and live Activity lifecycle verification.
- No global worker/advisor profile edits, project plugin installation, unrelated file changes, code changes, or sensitive telemetry capture.

## Acceptance criteria
1. After `guarana plugin install --plugins-only`, all three managed global Guarana plugin files match canonical managed content; bundled engines update as planned without worker/advisor profile writes.
2. OpenCode reload succeeds after the global update.
3. A real child session is observed in Activity with the correct parent session, child session, and agent identity, and its busy/running state is observed.
4. The same child session is subsequently observed idle/terminal in Activity history with observed timestamps.
5. No evt_* event IDs appear as session IDs, and lifecycle events lacking session identity create no fake sessions.
6. Telemetry and Activity output contain no prompts, outputs, hidden reasoning, or task titles.
7. Report the test outcome; if live proof fails, retain the source feature as VALIDATED and not SHIPPED, and record the exact blocker.

## Superseded diagnostic authorization (historical; no longer actionable)
- The earlier one-capture authorization using authenticated `opencode api get /api/event` is superseded by the later completed identity lookup recorded below. No further queries or captures are authorized; do not restart the capture plan. The OpenCode V2 docs describe `GET /api/event` as an experimental SSE subscription across server locations; a direct unauthenticated fetch returned HTTP 401, so it was not an approved method.
- The primary-session identifier from the earlier planning note is redacted. Prior child API data included parent ID, agent, and idle status while telemetry omitted those fields. Activity was stopped; the planned capture would not itself have established UI behavior.
- The historical listener plan was to ignore all other events and persist only the allowlisted projection: event type, envelope key locations, session ID, parent ID, agent, and status, plus loaded plugin source path/hash and server version. It prohibited persisting prompts, outputs, titles, tool arguments, other payload fields, or raw SSE/event objects.
- The artifact was to be external/ephemeral with mode `0600`. No app files, plugin source or installation, global profiles, telemetry JSONL, or service configuration were in scope.
- Supplied historical runtime facts: service API version `2.0.30`; `/api/plugin` reported `guarana.telemetry` loaded from `$XDG_CONFIG_HOME/opencode/plugins/guarana-telemetry.js`; its SHA-256 matched `$REPO_ROOT/plugin/guarana-telemetry.js` at `5e62afb068e291100b6f496593a28beaedc0ac71c6bea41e2b3e808105f64bee`.

8. An authenticated `opencode api get /api/event` listener captures one real native Task child lifecycle event and writes a mode-0600 external/ephemeral artifact containing only event type, envelope key locations, sessionID, parentID, agent, status, loaded plugin source path/hash, and server version; all other events are ignored and no raw SSE/event object or non-allowlisted data is persisted.
9. The diagnostic step makes no app, plugin source/install, global profile, telemetry JSONL, or service configuration changes, and does not capture prompts, outputs, titles, or tool arguments.
10. Keep this deployment follow-up TASKED until independent verification and any later UI acceptance; the native event capture alone is not Activity UI acceptance or a shipping claim.

## Latest planning update (2026-10-16)
- A safe authenticated `/api/plugin` shape check returned `data` as a 92-entry array. The temporary helper's `findTelemetryPlugin` visits only `value.slice(0,64)` for arrays (line 113); an exact full-list scan found both known Guarana plugin IDs with nested absolute `source.path` at indices 72 and 73.
- At that point, the metadata confirmed the helper selector's search-bound defect under current metadata and was a plausible explanation for the earlier empty capture. The post-run query did not prove which branch that earlier run took. Application telemetry cause remained unresolved.
- Then-proposed next bounded step (subsequently executed): widen only the temporary helper's per-array candidate cap to cover up to 128 entries while retaining the overall visited/depth/API-byte caps and exact selector; run `node --check`, obtain an independent audit, then make one changed-hypothesis live capture. Persist only the original allowlisted output under `$TMPDIR` with mode `0600`; make no application/plugin/profile/service/config edits and do not retry unchanged.
- At that milestone, worker-code reported only an external/ephemeral temporary helper named `activity-lifecycle-sse-capture.mjs` changed: per-array traversal cap 64→128. The global visited<256 cap, depth<=5, exact plugin ID plus nested absolute `source.path` selector, other bounds, identity logic, and persisted allowlist were unchanged. `node --check` passed; independent audit and live capture were then pending at that historical point.
- **Changed-hypothesis capture follow-up (2026-10-16):** After the cap widening was independently audited PASS, one changed-hypothesis live capture ran concurrently with a real worker-verify syntax-check Task. The child Task completed and returned syntax PASS; it was not stuck. The helper completed without stdout, and the sanitized capture file remained mode `0600`, size 0, with zero JSONL rows. No raw events were captured. A safe post-run `/api/plugin` metadata query found 92 entries and the exact telemetry plugin's nested absolute `source.path` at index 73. This confirms the earlier first-64 selector defect under current metadata, but does not explain why the corrected run remained empty. The application telemetry cause remains unknown. No application/plugin/profile/service/config source changes occurred. A proposed next diagnostic would add one fixed allowlisted stop-stage enum to temporary output only; because that expands the output schema it requires human approval. No such change or further capture is authorized yet.

## Approved one-capture stop-stage diagnostic plan (2026-10-16)
- The user explicitly approved adding exactly one temporary-output field, `stopStage`, as a string restricted to `metadata_error`, `stream_error`, `timeout_no_target`, `timeout_after_target`, `invalid_sse`, `invalid_lifecycle`, `identity_error`, `identity_mismatch`, `limit_reached`, `write_error`, or `captured`. It may be emitted as a one-field terminal JSONL record. No other output-schema changes are approved.
- The `stopStage` record must contain no raw errors, event content, IDs, prompts, outputs, titles, or tool arguments. Existing capture projection limits remain in force.
- Next, worker-code may update only the temporary helper. `node --check` and an independent worker-verify audit must both pass before exactly one live capture. Do not edit application/plugin source, profiles, services, or configuration.
- If the single capture still produces an empty file, stop and report its `stopStage`; do not retry. The real worker-verify child completed PASS in the prior attempt, no stuck session was reproduced, and the application telemetry cause remains unknown.
- Planning acceptance: explicit approval, the exact enum and output bounds, unresolved cause, and the one-capture stop condition are recorded. This deployment follow-up remains TASKED.

## Corrected stopStage audit checkpoint (2026-10-16)
- Independent `worker-verify` returned FAIL. Its criterion requiring no identifiers anywhere was overbroad: ordinary projection rows may retain the already-approved session ID, parent ID, agent, and provenance fields. Those normal rows should be checked against their exact allowlist; the one-field terminal record alone must contain only `stopStage` with a value from the fixed enum above.
- A byte-for-byte baseline is unavailable, so byte-equality is not an evidenced check and is replaced by exact allowlist checks for normal projection rows. No raw errors or other fields are authorized in the terminal record, and no other output-schema changes are approved.
- The terminal marker's `fs.writeSync` return value is unchecked. A short write is possible but was not observed. Before re-audit, worker-code should write the complete terminal marker with a bounded loop that advances by the returned byte count and stops on zero progress or error; do not add raw errors or change the schema.
- Next gate: make only that temporary-helper correction, run `node --check`, then obtain an independent worker-verify audit of terminal-record schema/permissions and exact normal-row allowlists. Do not run the helper, make API queries, or perform live capture before independent PASS. No app source, profile, or config changes occurred; this feature remains TASKED and the application telemetry cause remains unresolved.

## Latest independent audit result and correction (2026-10-16)
- Independent `worker-verify` returned FAIL on two criteria in the restored temporary helper. First, the global traversal cap is 256, above the approved cap of 128; the per-array cap is already 128. Second, normal projection rows still use unchecked one-shot `fs.writeSync` and increment `written` without validating the returned byte count. The terminal marker has an offset loop, but zero/error currently breaks or is swallowed and does not ensure that a partial record is not left behind.
- The next bounded helper-only correction is to set the global visit cap to 128 and use one bounded full-write helper for both normal projection rows and terminal lines. Advance only by each positive valid byte count; on zero, invalid progress, or error, abort without counting success or appending further data. Roll back a partial line to the prior file length if feasible.
- Preserve the exact allowlist, enum, nested `source.path` selector, identity fields, mode `0600`, and all other bounds. Do not make application source edits. Do not run the helper, query the API, or capture until a fresh independent audit passes. Feature status remains TASKED; the application telemetry cause remains unresolved.

## Helper correction milestone (2026-10-16)
- Worker-code reports the temporary helper now uses a global visited-node cap of 128 and a shared bounded 16 KiB JSONL-line buffer/writer for normal projection and terminal `stopStage` records.
- Write progress uses explicit file positions and advances only on positive byte counts. Failed or invalid writes attempt rollback to the prior file size when possible, set a fixed internal `outputWriteFailed` flag, and increment the projection count only after complete success. Mode `0600` is reapplied around writes.
- `node --check` passed. No repository source changes, helper run, API query, or live capture occurred. A fresh independent worker-verify audit of both output paths and their exact allowed schemas is pending; no capture is authorized before PASS. The feature remains TASKED and the application telemetry cause remains unresolved.

## Primary decision and bounded identity lookup (2026-10-16)
- Following the final capture's `timeout_no_target` result, the human asked the primary to choose between stopping and one read-only identity lookup. The primary chose exactly one authenticated lookup for the already-completed worker session.
- The lookup may inspect only `agent` and `parentID`, compare only boolean match results against the expected worker and parent, and must not print either identifier. Do not create a Task child, open an event stream, run the helper, or retry.
- If the API fails or either field is missing or conflicts, stop and preserve uncertainty. This lookup may distinguish an identity/parent mismatch but cannot prove event delivery or the application telemetry root cause. This is a plan only; no lookup result or new proof is claimed. Keep the feature TASKED.

## Authorized identity lookup result (2026-10-16)
- The single authorized authenticated `/api/session/<completed-child>` lookup succeeded: identity complete=true, expected worker match=true, and expected parent match=false. No session identifiers are recorded.
- The parent mismatch proves this child's target was rejected by the helper's parent filter and explains `timeout_no_target` for this attempt. It does not prove whether lifecycle events were otherwise delivered or the underlying Activity telemetry cause.
- The child Task completed PASS; no stuck session was reproduced. No further queries or captures are authorized. No app, plugin, profile, service, or configuration changes occurred. This deployment follow-up remains TASKED.

<!-- guarana:record:start -->
Status: TASKED
Proof: The authorized /api/session/<completed-child> query succeeded: identity complete=true, expected worker match=true, expected parent match=false; no identifiers are recorded.; The parent mismatch proves this child's target was rejected by the helper's parent filter and explains timeout_no_target for this attempt, but does not prove lifecycle event delivery or the underlying Activity telemetry cause.; The child Task completed PASS; no stuck session was reproduced; no further queries or captures are authorized.
Change: none
<!-- guarana:record:end -->
