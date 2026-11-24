# Feature spec: Learning-review runtime module placement

**Status: SHIPPED**

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

## Authorized global install closeout (2026-11-24)

- After explicit user authorization, `node bin/guarana.js plugin install --plugins-only` succeeded, replacing exactly `~/.config/opencode/memory/learning-review.js` (an untracked conflict) and `~/.config/opencode/plugins/guarana-memory.js` (a manifest hash mismatch).
- Global status reports the helper as `ok (up to date)` at `~/.config/opencode/memory/learning-review.js`; the manifest tracks it under `engines.memory`, with no standalone plugin entry.
- Worker-profile bytes compared before and after were unchanged; some profiles still report stale/foreign.
- OpenCode was not reloaded, and no package release occurred.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: Historical implementation validation checkpoint, before the later authorized global install and source shipment: Fresh independent worker-verify overall PASS, criteria 1–6: canonical memory/learning-review.js and cli/memory/learning-review.js are byte-identical; imports use the sibling memory path; production helper copies are absent from plugin directories; sync/parity enforcement is present; isolated project/global install and status place the helper under memory and in manifest.engines.memory but not new manifest.plugins; full uninstall removes it; --plugins-only removes owned legacy plugin helper while retaining the new engine/module; marker-owned and tracked legacy copies migrate; tracked hash mismatch and foreign markerless files fail closed before mutation; rollback includes the old target; deployed-layout fixture imports the sibling module and engine. Verifier focused mapped tests PASS 79/79; npm run check-cli PASS; Specs validation PASS (262 Markdown files, 102 features, 48 ADRs, 302 links, 0 issues); git diff --check PASS. Primary npm test PASS 628/628. No real OpenCode install, reload, deployment, commit, or release occurred; no global profile was changed. This was the implementation validation checkpoint, not a shipping claim.; After explicit user authorization, `node bin/guarana.js plugin install --plugins-only` succeeded, replacing exactly `~/.config/opencode/memory/learning-review.js` (untracked conflict) and `~/.config/opencode/plugins/guarana-memory.js` (manifest hash mismatch). Global status reports helper `ok (up to date)` at `~/.config/opencode/memory/learning-review.js`; manifest tracks it under `engines.memory`, with no standalone plugin entry. Worker-profile bytes compared before/after were unchanged; some still report stale/foreign. OpenCode was not reloaded.; Source commit 00f427b03bcbca837686bc84ae259cd6efe02918 (chore(release): prepare Guarana 1.5.3 source candidate), parent 0ae04b37041fee8e48c919212cbbf0ce344a9cda, was pushed normally to https://github.com/leorsousa05/guarana.git; push output was 0ae04b3..00f427b main -> main. Immediately after push, git ls-remote origin refs/heads/main returned exactly 00f427b03bcbca837686bc84ae259cd6efe02918, equal to local HEAD, and checkout was clean. Candidate worker-verify gate overall PASS criteria 1–5; npm run build PASS; npm test PASS (628/628); npm run check-cli PASS; Specs validation PASS (263 files, 103 features, 48 ADRs, 302 links, 0 issues); both diff checks PASS. npm pack --dry-run --json inventory-only for guarana@1.5.3: 105 files, LICENSE/CHANGELOG.md/RELEASING.md included, no node_modules, no tarball. No tag, npm publication or dist-tag, GitHub Release, formal package release, force push, or retired smoke occurred; source remains unpublished and untagged.
Change: none
<!-- guarana:record:end -->
