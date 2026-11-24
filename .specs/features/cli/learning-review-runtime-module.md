# Feature spec: Learning-review runtime module placement

**Status: VALIDATED**

## Goal
Install the CLI learning-review runtime module outside plugins/ so OpenCode does not auto-discover it as a plugin.

## Requirements
- Place the learning-review runtime helper outside plugins/ so OpenCode does not auto-discover it as a plugin.
- Use memory/learning-review.js as the canonical helper and cli/memory/learning-review.js as its distributable copy; the canonical and CLI memory plugins import ../memory/learning-review.js, and the memory engine manifest owns the helper.
- Migrate legacy plugin helper ownership using tracked hashes and existing Guarana marker semantics, refusing tracked hash mismatches and foreign markerless files before install or uninstall mutations.
- Record the assigned budgets in this feature: worker-code 8k tokens, worker-verify 4k tokens, and a per-run hard cap of 32k tokens/15 minutes (ADR-005).

## Assumptions and scope
- The new canonical helper is memory/learning-review.js and its CLI bundle counterpart is cli/memory/learning-review.js; the memory plugin imports the sibling module at ../memory/learning-review.js.
- The memory engine manifest owns the new helper.
- Migration follows existing ownership semantics: remove a tracked legacy plugins/learning-review.js only when its tracked hash matches, or an untracked legacy file recognized by the existing Guarana marker; refuse a tracked hash mismatch or foreign markerless file before any install/uninstall mutation.
- plugin uninstall --plugins-only removes a managed legacy plugin copy but retains the new memory engine and module.
- Do not perform live global/project installation, reload, deployment, or alter any customized global profile.
- Canonical helper import/layout and CLI bundle synchronization/parity.
- CLI install, status, uninstall, and manifest migration for project and global paths, with tests.
- Exclude actual user configuration mutation, release/version/commit actions, and unrelated TTY changes.

## Acceptance criteria
1. Canonical runtime module is memory/learning-review.js, the distributable copy is cli/memory/learning-review.js, canonical/CLI memory plugin imports ../memory/learning-review.js, and source/bundle parity checks enforce that layout; no helper copy remains under plugin/ or cli/plugin/.
2. Isolated project and temporary-global install tests show byte-identical helper at <OpenCode root>/memory/learning-review.js, tracked in manifest.engines.memory and absent from new manifest.plugins; plugin status reports the module at the memory path.
3. Full uninstall removes the managed module; --plugins-only removes managed old plugin-directory copy but leaves the new memory engine/module, matching existing engine semantics.
4. Legacy migration removes only an owned old plugins/learning-review.js and drops its legacy plugin-manifest entry. Tracked hash mismatch and foreign markerless target cause fail-closed refusal with target bytes, install manifest, other plugins and engines unchanged; regression tests prove both cases.
5. Installed-layout regression imports the memory plugin from plugins/ with the sibling memory engine/module and exercises the learning-review import. Focused tests, full test suite, npm run check-cli, specs validation, and git diff --check pass before final independent verification.
6. Feature budget text records worker-code 8k tokens; worker-verify 4k; per-run hard cap 32k tokens/15 minutes (ADR-005).

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS, criteria 1–6: canonical memory/learning-review.js and cli/memory/learning-review.js are byte-identical; imports use the sibling memory path; production helper copies are absent from plugin directories; sync/parity enforcement is present; isolated project/global install and status place the helper under memory and in manifest.engines.memory but not new manifest.plugins; full uninstall removes it; --plugins-only removes owned legacy plugin helper while retaining the new engine/module; marker-owned and tracked legacy copies migrate; tracked hash mismatch and foreign markerless files fail closed before mutation; rollback includes the old target; deployed-layout fixture imports the sibling module and engine.; Verifier focused mapped tests PASS 79/79; npm run check-cli PASS; npm run specs:validate -- --json PASS (262 Markdown files, 102 features, 48 ADRs, 302 links, 0 issues); git diff --check PASS.; Primary npm test PASS 628/628.; Implementation paths: memory/learning-review.js; cli/memory/learning-review.js; plugin/learning-review.js (deleted); cli/plugin/learning-review.js (deleted); plugin/guarana-memory.js; cli/plugin/guarana-memory.js; plugin/learning-review.test.mjs; plugin/guarana-memory.deploy.test.mjs; cli/constants.js; cli/lib/paths.js; cli/lib/paths.test.js; cli/lib/artifact-transaction.js; cli/commands/plugin.js; cli/commands/install.test.js; cli/commands/plugin.test.js; cli/commands/uninstall.test.js; cli/commands/transaction.test.js; scripts/sync-cli-bundle.mjs; scripts/check-cli-bundle.mjs; scripts/sync-cli-bundle.test.mjs.; No real OpenCode install, reload, deployment, commit, or release occurred; no global profile was changed. This task is VALIDATED, not SHIPPED.
Change: none
<!-- guarana:record:end -->
