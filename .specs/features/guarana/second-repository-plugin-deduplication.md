# Feature spec: Second-repository Guarana plugin deduplication

**Status: VALIDATED**

## Goal
Remove duplicate project-scoped Guarana plugin copies from `$TARGET_REPO`, retain the global plugins, and confirm the Guarana Primary remains available.

## Requirements
- In the target, use only `guarana plugin uninstall --plugins-only --project`; the exact expected removals are `.opencode/plugins/guarana-telemetry.js`, `.opencode/plugins/guarana-memory.js`, `.opencode/plugins/guarana-orchestrator.js`, and the manifest `plugins` group.
- Preserve global plugin bytes; project engines, skills, worker/primary profiles, settings, memory/vault, and every non-plugin manifest group.
- After a stable reload, OpenCode V2 agent API lists one visible `guarana` primary using `openai/gpt-6-luna` with `medium`; project plugin status says plugins are not installed locally while engines/profiles are current; `opencode plugin list` has exactly one global source per Guarana plugin ID.
- Record that removed copies were duplicates but not stale because hashes matched canonical, CLI, global, and target project sources; the TUI visibility symptom is not claimed fixed.
- No code changes, full uninstall, unrelated cleanup, or commit. The target is not a Git repository; make no Git-cleanliness claim.

## Assumptions and scope
- The user explicitly chose `Remover locais (Recomendado)` for this exact target; the accepted implementation facts below are a deployment milestone, not independent validation.
- Only the project-scoped Guarana plugin copies and project manifest `plugins` group in `$TARGET_REPO` are in scope.
- Global plugins and all non-plugin artifacts and manifest groups are preserved; no external target or global artifacts are to be changed by this record task.

## Acceptance criteria
1. In the target, `guarana plugin uninstall --plugins-only --project` removes exactly the three managed project plugin files and the manifest `plugins` group, with no other target artifact changes.
2. Before/after evidence confirms the global plugin bytes, engines, skills, project profiles, settings, vault, and all non-plugin manifest groups are unchanged; advisor settings remain absent.
3. After a stable reload, OpenCode V2 agent API returns one visible `guarana` agent in primary mode with model `openai/gpt-6-luna` and variant `medium`; target project status reports local plugins absent and engines/profiles current.
4. `opencode plugin list` shows exactly one global source for each Guarana plugin ID.
5. The record states that project copies were duplicates but not stale because their hashes matched canonical, CLI, and global sources; it does not claim the TUI visibility symptom is fixed.
6. No code change, full uninstall, unrelated cleanup, commit, or Git-cleanliness claim is made.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall PASS for all six acceptance criteria; this corrected fresh PASS supersedes the earlier aggregation-method-only discrepancy. The verifier reports specs validator PASS with 178 files and 0 issues; exact validator command and verifier session ID were not supplied.; In $TARGET_REPO, only plugin-only project uninstall was used. The three project files .opencode/plugins/guarana-memory.js, .opencode/plugins/guarana-orchestrator.js, and .opencode/plugins/guarana-telemetry.js are absent; the project manifest plugins group is absent.; Correct nested per-directory aggregation was recomputed and matches baselines: engines SHA-256 13e1be3ad6f1eef9dc96bb422d3259de5c78b85f6d93988e099ca42b680052fd; skills 199d09491f102bbaa34852ec8c6c3b16761bccda8f1020b763c48f94d6ef2592; profiles 6b972d3e7b90f62d7e77dda2cea030e893f17f26d606c84fdf99cf42e13a5258; vault 7aa0630d96d8dc3bf97ee90ab4040a06b15a8039e3f9b36c512047cf286e6f87; global plugin aggregate 4545fcb77f4b7c996e40ccee46ae9e4b7c397a9042afc0d24d801741d29816df. Project Advisor settings remain absent and non-plugin manifest groups are preserved.; Primary-authenticated post-cleanup output collected by the primary and supplied to the verifier lists exactly one guarana with mode primary, hidden false, model openai/gpt-6-luna, and variant medium. The verifier's isolated API request returned 401, so it cites the primary-collected real output and does not claim independent API access. The TUI visibility symptom is not claimed fixed.; Post-cleanup opencode plugin list shows exactly one global source for each Guarana plugin ID. Project plugin status reports local plugins absent and engines, vault, workers, and Primary current and healthy; the optional Advisor subagent is absent.; Before removal, each project plugin hash matched canonical plugin/, CLI cli/plugin/, and global copies; they were duplicates, not stale. Pre-cleanup hash evidence: sh_13af0fc4c001wIUxtgJdT2U1C7.out:2-18 (temporary external artifact, not retained in repository). Cleanup log: opencode.log:135794 (temporary external artifact, not retained in repository). Cleanup shell output: sh_13af5a8b80012vNge5FniOaErg.out:1-6.; The initial verifier discrepancy was only flat-versus-nested aggregation; worker-debug recorded the mitigation in known-issues and corrected independent verification passed. No known-issues file was changed by this record update.; No code or global artifact change occurred. The target is not a Git worktree, so no Git-cleanliness claim is made. No release or shipping occurred; status remains VALIDATED only, not SHIPPED.
Change: none
<!-- guarana:record:end -->
