# Feature spec: Project worker catalog discoverability

**Status: VALIDATED**

## Goal
Make project-scope Guarana worker agents discoverable in this repository's OpenCode subagent catalog, with the behavior persisted by the tracked profile generator and no global visibility change.

## Requirements
- OpenCode V2 removes agents with hidden: true from the subagent catalog.
- The project worker-code, worker-debug, worker-specs, and worker-verify profiles are visible subagents after reload.
- Generated global worker profiles remain hidden, `guarana-advisor` remains hidden, and the durable project/global visibility distinction is implemented in the tracked profile generator.
- `cli/lib/agents.js` must generate `hidden: false` for the four project-scope worker profiles and `hidden: true` for the corresponding global-scope worker profiles.
- CLI tests must prove both project and global generation modes and confirm reinstall/status remains consistent with the generated visibility.
- The four local project `.opencode/agents/worker-*.md` edits are ignored by `.gitignore:30`; leave them ignored and do not force-add them. The tracked generator source carries the durable behavior.
- Project-only worker visibility is explicitly approved; do not unhide global agents or `guarana-advisor`.

## Assumptions and scope
- `cli/lib/agents.js` and its CLI tests are the durable implementation scope; generated project and global profiles must retain distinct visibility by scope.
- The four local project profiles `.opencode/agents/worker-code.md`, `worker-debug.md`, `worker-specs.md`, and `worker-verify.md` are ignored generated/local files and must not be force-added.
- Do not unhide global workers or `guarana-advisor`, or change unrelated files.

## Acceptance criteria
1. Generated project-scope worker-code, worker-debug, worker-specs, and worker-verify profiles all have `hidden: false`.
2. Generated global-scope worker profiles all have `hidden: true`; global workers and `guarana-advisor` are not made visible.
3. CLI tests prove both generation modes and that reinstall/status remains consistent with the generated profiles.
4. After reload, the effective OpenCode catalog lists worker-code, worker-debug, worker-specs, and worker-verify as mode: subagent with hidden: false.
5. When the available subagent tool permits it, dispatch a worker and confirm the worker invocation; otherwise record the limitation without claiming dispatch proof.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS for generator persistence; status is VALIDATED, not SHIPPED.; profiles(true): all four project workers have hidden:false; profiles(false): all global worker profiles have hidden:true; mode, permissions, and body are identical apart from visibility.; Tests cover project/global install/status.; opencode reload returned Configuration reloaded; debug agents showed four project workers mode=subagent hidden=false and advisor hidden=true; global files remain hidden:true.; .opencode is ignored and was not force-added.; Focused CLI/plugin tests PASS (26/26); npm test PASS (462/462); npm run build PASS; npm run check-cli PASS; guarana specs validate PASS (174 files, 0 issues); git diff --check PASS.; Code extension changed only cli/lib/agents.js and cli/lib/agents.test.js; baseline dirty unrelated changes were not attributed.; No commit or push yet; no SHIPPED claim.
Change: none
<!-- guarana:record:end -->
