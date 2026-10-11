# Feature spec: Validate Guarana 1.2.0 candidate with correct bump/changelog before commit and push

**Status: VALIDATED**

## Goal
Independently validate the selected local Guarana 1.2.0 candidate and its change scope before any separately authorized commit or push, without publishing or tagging it.

## Requirements
- Record the supplied decision that 1.2.0 is a minor bump from prior 1.1.0 for additive dashboard and CLI changes; do not reconsider or extend that version decision.
- The user authorized commit and push and requested the version bump, but no staging, commit, or push is part of this validation step; the candidate remains unpublished and untagged.
- Confirm package.json, the README version badge, and CHANGELOG.md agree on 1.2.0 and that the changelog describes an unpublished candidate.
- Validate the previously reported gates with proof: npm test on Node 24 and Node 22; npm run build and dashboard bundle synchronization; npm run check-cli; package contents exclude node_modules; npm run smoke:pack; and specs validate.
- Review the working tree and distinguish intended source, documentation, generated dashboard bundles, and relevant human-readable .specs records from local artifacts and operational state.
- Keep unrelated archive-0w9fZ3 and operational .specs/state/workflow.json outside any commit.

## Assumptions and scope
- Validation and working-tree classification only; no code changes.
- No release, package publish, or Git tag; no staging, commit, or push in this validation step.
- Prior gate outcomes are reported but this handoff contains no proof of their completion; do not claim they passed without recorded proof.
- Do not infer requirements beyond the supplied version, validation gates, scope boundaries, and acceptance criteria.

## Acceptance criteria
1. package.json, README version badge, and CHANGELOG.md consistently identify the unpublished 1.2.0 candidate.
2. Every listed validation gate passes and has factual command/runtime/result proof recorded; missing or failed proof is reported without a pass claim.
3. The working-tree review distinguishes intended source, documentation, generated dashboard bundles, and relevant human-readable specs from local artifacts and operational state, explicitly excluding archive-0w9fZ3 and .specs/state/workflow.json from any commit.
4. No commit or push occurs in this validation step, and no release, publish, tag, or code change occurs.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify verdict PASS 5/5 for candidate validation; the README correction resolved the only earlier failure.; Criterion 1 PASS: package.json:3, README.md:28 and :251-253, and CHANGELOG.md:38 identify unpublished 1.2.0; README says the release gate remains incomplete.; Criterion 2 PASS: npm test 439/439 on Node v24.20.0 in prior verified worker output and Node v22.23.3; Node 22 output artifact: /home/arch/.local/share/opencode/tool-output/tool_12988e8e70019qEpnh6D7M4rbj. No other test log path was supplied.; Criterion 3 PASS: npm run build/sync and npm run check-cli parity passed; fresh npm pack --dry-run had 122 entries, zero node_modules, and README, changelog, and dashboard assets.; Criterion 4 PASS: npm run smoke:pack passed with 122 files and no node_modules.; Criterion 5 PASS: git diff --check passed; archive-0w9fZ3 remains untracked and .specs/state/workflow.json is operational modified state; cached diff is empty; HEAD equals origin/main; no 1.2.0 tag exists and npm registry returned E404; no staging, commit, push, or publish occurred.; Specs gate guarana specs validate . --json returned ok=true: 157 files scanned, 40 feature specs, 30 ADRs, 205 links, 0 issues.; Candidate validation is VALIDATED only, not SHIPPED; no release action occurred.
Change: none
<!-- guarana:record:end -->
