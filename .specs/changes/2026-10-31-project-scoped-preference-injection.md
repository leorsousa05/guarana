# Change — Project-scoped preference injection

**Status: VALIDATED — final independent verification passed; not SHIPPED.**

## Outcome

Project preference writes are categorized and scoped; automatic injection selects only confirmed, validly categorized preferences from the current project and combines them with Global preferences under the shared budget without truncation. Project preferences render in a separate trust-labeled group. Dashboard estimates aggregate eligible selected-project and Global candidates without exposing records. Canonical/CLI behavior and documentation are aligned. All tests used synthetic fixtures; actual project and Global vaults were not inspected or mutated, and no supplied Global candidate was reclassified. ADR-048 remains accepted; no new ADR was needed.

## Independent verification and checks

- Historical verification chronology: the first review failed because record counts and ADR implementation state were stale. The prior implementation `worker-verify` overall PASS (8/8) remains historical and is not the latest final result.
- A subsequent final review failed criterion 2 on overly literal R3 “not read” wording, although the selector enumerates only the selected project's shared `nodes.jsonl` to identify eligible preferences; worker-debug classified this as an acceptance-wording mismatch, not a product defect. It also found stale lower-section global-only memory-skill guidance (criterion 6). The selected-vault boundary clarification and this documentation correction are complete.
- The latest `worker-verify` before the documentation correction failed criterion 6 on internal memory-skill contradictions: top-level global-only/full-payload claims, save/draft rules, and all-or-nothing budget wording. The canonical memory skill was comprehensively corrected; `npm run build` then synchronized all CLI files, including the memory skill. At that recorded checkpoint, a fresh final independent `worker-verify` remained pending and no latest PASS was claimed.
- `npm test` — PASS, 721/721, 0 failures; nonfatal Vite WebSocket port 24678-in-use and Node MODULE_TYPELESS warnings.
- After the canonical skill correction, `npm run build` — PASS (Vite 60 modules; canonical-to-CLI sync copied all CLI files, including the skill); `npm run check-cli` — PASS.
- After the documentation correction, `npm run specs:validate -- --json` — PASS: `{"ok":true,"filesScanned":261,"featureSpecs":101,"adrs":48,"linksChecked":300,"issues":[]}`; `git diff --check` — PASS. At that recorded checkpoint, final independent verification remained pending.
- Final fresh independent `worker-verify` after all corrections — overall PASS (8/8). It verified the categorized write/schema and draft matrix; selected-vault-only preference projection without project graph expansion; shared project, Global direct, related, and superseded budget behavior with complete-record skipping; lower-trust prompt placement; aggregate count/bytes-only estimates and selected-project routing; approximate Settings labeling; canonical/CLI documentation parity; synthetic-only fixtures with no real-vault access or mutation and no preference reclassification; and final gates.
- Independent gates — `npm test` PASS (721/721); `npm run check-cli` PASS; `npm run specs:validate -- --json` PASS (`{"ok":true,"filesScanned":261,"featureSpecs":101,"adrs":48,"linksChecked":300,"issues":[]}`); `git diff --check` PASS. The verifier did not rerun the asset-writing build. The primary's post-correction `npm run build` passed (Vite 60 modules; canonical-to-CLI synchronization, including the memory skill).

## Boundary

No commit, push, package publish, tag, deployment, runtime install, or shipping occurred. Feature status is VALIDATED, not SHIPPED. All tests used synthetic fixtures; actual project and Global vaults were not inspected or mutated, and all 18 supplied candidate entries remain Global.
