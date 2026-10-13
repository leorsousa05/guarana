# Feature spec: OpenCode V2 plugin compatibility and safe global install

**Status: VALIDATED**

## Goal
Migrate Guarana telemetry, memory, and orchestrator plugins to OpenCode V2 while retaining V1 compatibility; keep the global plugin installations and safely remove only their duplicate project-level copies, preserving unrelated managed artifacts.

## Requirements
- The OpenCode v2.0.28 host rejected all three plugins with Plugin must export a default definition with an id and an effect or setup function.
- Official V2 plugin and migration documentation states V1 implementations do not run in V2 and supports a hybrid default export with V2 setup(ctx) and V1 server(). The user explicitly approved V2 plus V1 compatibility.
- The initial implementation added stable V2 IDs and setup adapters, retained V1 server hooks, added tests, and synchronized CLI copies. The implementation milestone also completed safe global/project installs, `plugin install --plugins-only`, and ownership-checked transactional `plugin uninstall --plugins-only`; project duplicate cleanup was executed. Focused tests 34/34, `npm test` 461/461, `npm run check-cli`, diff-check, and specs validation 172 files/0 issues have passed. Final independent verification remains pending.
- `opencode plugin list` showed two sources for each plugin ID: global files at `/home/arch/.config/opencode/plugins/guarana-{memory,orchestrator,telemetry}.js` and project copies under `/home/arch/codes/Guarana/.opencode/plugins/`, with matching SHA values for each pair. The user explicitly chose to keep the global copies and remove only the three duplicate project copies.
- Supplied logs at 2026-10-13 19:46 showed global and project plugins loading without warnings; earlier schema errors precede the migration. After the cleanup/update, logs at 2026-10-13 20:11:34 show all three global plugins loading without failure.
- The ownership-checked transactional `guarana plugin uninstall --plugins-only --project` path was executed and removed exactly `.opencode/plugins/guarana-telemetry.js`, `.opencode/plugins/guarana-memory.js`, and `.opencode/plugins/guarana-orchestrator.js`.
- Do not remove or modify global plugin files, project engines, profiles, manifest groups other than `plugins`, configuration, or unrelated working-tree changes. Do not commit.
- Pre/post hashes prove project engines, worker/advisor profiles, global plugin files, and project manifest `engines/workers/advisor/skills/future` groups are unchanged; project manifest `plugins` group is absent. Project status reports plugins not installed and engines/profiles healthy and up to date; global status reports all three plugins up to date. `opencode plugin list` shows one global source per Guarana ID.
- README documents `plugin install --plugins-only`, `plugin uninstall --plugins-only`, and default uninstall profile/engine behavior. The earlier documentation-only failure was resolved; final independent verification passed all five criteria.
- V1 acceptance is the hybrid server contract and tests; an actual V1-host smoke may be unavailable.

## Assumptions and scope
- The described hybrid default export and tests are the required V1 compatibility gate if a V1 host is unavailable; do not claim an actual V1-host smoke without evidence.
- Initial implementation checks are historical self-check evidence; the final independent worker-verify PASS below establishes acceptance of all five criteria.
- In scope: V2/V1 plugin adapters, safe global/project installs, plugins-only install and uninstall paths with tests, project duplicate-plugin removal, accurate README install/uninstall guidance, and required specs records.
- Out of scope: global plugin removal or modification; project engine, worker/advisor profile, configuration, or other manifest-group changes; unrelated working-tree changes; and creating a commit.

## Acceptance criteria
1. Tests prove `guarana plugin uninstall --plugins-only --project` performs an ownership-checked transaction that removes only the three project plugin files and the project manifest `plugins` group, while preserving project engines, worker/advisor profiles and their manifest groups; ordinary uninstall behavior remains intact. The executed cleanup removed exactly the three plugin files.
2. All three plugins satisfy the OpenCode V2 default-definition/setup contract and retain the V1 server contract, with regression tests for both contracts.
3. README accurately describes both `guarana plugin install --plugins-only` and `guarana plugin uninstall --plugins-only`, including the actual default uninstall behavior for profiles and engines; final independent verification passed this criterion.
4. Canonical and global plugin copies are byte-identical; project plugin copies and the project manifest `plugins` group are absent; project engines/profiles and their manifest groups and global plugin files are unchanged. Project/global status matches the resulting state, `opencode plugin list` shows one global source per ID, and the latest supplied server logs show no plugin load failure.
5. Focused plugin/transaction tests (41/41), full `npm test` (461/461), CLI parity, diff check, and specs validation pass; final independent verification passed. No engine, profile, configuration, or unrelated working-tree changes and no commit occur.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall PASS, all five criteria. Stable V2 IDs/setup and V1 server contracts in plugin/guarana-memory.js, plugin/guarana-orchestrator.js, and plugin/guarana-telemetry.js; plugin/plugin-v2-compat.test.mjs covers both contracts and behavior.; OpenCode v2.0.28 logs: all three global plugin loads INFO at 2026-10-13T20:11:34 with no subsequent Guarana failures; historical schema errors through 19:32:41 only.; cli/commands/plugin.test.js and cli/commands/transaction.test.js verify install/uninstall --plugins-only safety and default behavior for project/global, preservation, ownership refusal, and rollback. README/help/metadata accurate; CLI help confirms syntax.; node bin/guarana.js plugin uninstall --plugins-only --project removed exactly .opencode/plugins/guarana-telemetry.js, .opencode/plugins/guarana-memory.js, and .opencode/plugins/guarana-orchestrator.js. Before/after hashes identical for project engine tree, all project worker/advisor profiles, all global plugin files, and non-plugin manifest groups engines/workers/advisor/skills/future; plugins group removed.; Global plugin status: all three up to date. Project status: plugins not installed, engines and profiles deployed/current. opencode plugin list: each Guarana ID appears exactly once from /home/arch/.config/opencode/plugins/. Global worker-specs remains stale/foreign and unchanged; explicitly preserved.; guarana specs validate . --json PASS: 172 files, 55 feature specs, 30 ADRs, 205 links, 0 issues. Focused plugin/transaction tests PASS 41/41. npm test PASS 461/461 with non-failing WebSocket port-in-use warnings. npm run check-cli reports CLI bundle matches. git diff --check clean.; No real artifacts changed during independent verification. No release, publish, or ship action occurred; status is VALIDATED, not SHIPPED.
Change: none
<!-- guarana:record:end -->
