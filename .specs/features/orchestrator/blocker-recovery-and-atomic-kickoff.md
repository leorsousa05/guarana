# Feature spec: Blocker recovery and atomic workflow kickoff

**Status: VALIDATED**

## Goal
Prevent premature stops on evidence gaps, make verification proportional, and reduce visible workflow kickoff calls without weakening state, history, or safety.

## Requirements
- For material criteria, guarana:plan maps observable evidence to authoritative sources and identifies access or authority limits early; investigate before asking, and ask only for material unresolved choices or actual privileged access, not routine already-authorized safe steps.
- When evidence is missing, guarana:verify and the generated worker-verify profile perform bounded searches of supported authoritative or alternative sources before stopping; label evidence not checked, unavailable in this context, contradictory, or absent accurately; continue feasible independent checks; report attempts, the best supported conclusion, and the smallest concrete unblock.
- Missing proof never permits PASS or SHIPPED; do not fabricate evidence, bypass policy, or infer absence from a scoped null.
- guarana:build and applicable test guidance continue safe independent work around blockers, do not repeat identical denied requests, and ask only for a real decision or privileged permission; select the smallest ordinary tests mapped to changed acceptance criteria, with no default smoke or elaborate/full E2E; preserve mandatory native Task isolation and actual tool permission denials.
- Add workflow_tick action start_task. After discovery is closed and any required worker-specs record is reported, one public call applies new_task -> planning -> plan_complete -> building -> run_start -> coding atomically and persists the three normal history events in order; require explicit nonempty goal and verifiable condition; preserve individual actions for genuinely open planning and other stage transitions.
- Do not collapse or erase workflow history or skip planning in the prompt. The atomic kickoff ends in coding and rejects missing requirements or illegal state without partial persistence; individual actions remain compatible.
- Plugin bootstrap, telemetry, and system injection reflect all three transitions; task-worker calls remain denied; canonical sources and cli/ mirrors stay synchronized.
- Use the next append-only ADR, ADR-037, for the durable workflow tool/API contract decision and its supplied alternatives. The current maximum ADR is ADR-036.
- Planning evidence supplied: source checkout HEAD 195b8ab, clean; active global guarana resolves to this checkout at version 1.4.0; ADR-036 prohibits smoke tests.
- Refresh the already-installed global Guarana profiles after implementation. Keep package version 1.4.0; do not commit, push, tag, or publish to npm.

## Decision record

The atomic `workflow_tick(start_task)` API contract is recorded in [ADR-037](../../decisions/ADR-037-atomic-workflow-task-kickoff.md). ADR-036 continues to prohibit smoke tests.

## Assumptions and scope
- Blocker-recovery guidance for guarana:plan, guarana:verify, guarana:build, generated worker-verify guidance, and applicable test guidance.
- One public workflow_tick(start_task) action and corresponding workflow state, history, plugin bootstrap, telemetry, system-injection, and test behavior.
- Focused workflow/state/plugin/prompt/worker-profile tests, CLI parity, and specs validation; refresh installed global Guarana profiles after implementation.
- No smoke tests, no unrequested full E2E, no package version change, no commit, push, tag, or npm publication.

## Acceptance criteria
1. Current plan, verify, and build guidance distinguishes missing, unavailable, and not-observed evidence; requires bounded feasible follow-through and an exact unblock; and preserves honest evidence gates and security boundaries.
2. Current tests are mapped proportionately to changed acceptance criteria; smoke remains prohibited; native worker role isolation is unchanged.
3. Public workflow_tick(start_task) atomically ends in coding, preserves new_task, plan_complete, and run_start history entries and goal/condition, rejects missing requirements or illegal state without partial persistence, and leaves individual actions compatible.
4. Plugin bootstrap, telemetry, and system injection reflect all three transitions; task-worker calls remain denied; canonical sources and cli/ mirrors stay synchronized.
5. Focused workflow/state/plugin/prompt/worker-profile tests, CLI parity, and specs validation pass; no smoke or unrequested full E2E runs.
6. Already-installed global Guarana profiles are refreshed after implementation; package version remains 1.4.0; no commit, push, tag, or npm publication occurs.
7. The primary workflow's canonical skill/prompt instructions (with CLI mirrors synchronized) make progress reports mandatory after each meaningful completed phase/subtask. Each report states what completed, what changed, the next action, and what remains or is blocked; distinguishes phase/subtask completion (including planning) from whole-task completion and does not imply whole-task completion before verification and final gates. The final report additionally lists exact changed paths and checks with their results. Memory alone is not implementation proof.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify returned PASS for repository code/readable-artifact verification; acceptance criteria 1–5 and 7 passed.; node --test orchestrator/workflow.test.js orchestrator/prompt.test.js plugin/guarana-orchestrator.test.mjs cli/lib/agents.test.js cli/orchestrator/workflow.test.js cli/orchestrator/prompt.test.js -> 150/150 PASS.; npm run check-cli -> CLI bundle matches canonical sources.; node bin/guarana.js specs validate . --json -> ok; 200 files scanned, 75 feature specs, 37 ADRs, 219 links, zero issues.; git diff --check -> pass.; Post-PASS local guarana update -> Version 1.4.0; Global target /home/arch/.agents/skills/guarana; refreshed 8 skills, 3 plugins, 3 engines, and 4 worker profiles.; diff -qr --exclude=.guarana-version cli/skills/guarana /home/arch/.agents/skills/guarana -> no differences; guarana --version and installed stamp both report 1.4.0.; Sequential guarana plugin status confirms three plugins, engines, and all four worker profiles current; optional advisor-agent profile remains uninstalled and is outside this feature.; After the authorized global update, calling workflow_tick(start_task) in this active session returned unknown action: start_task; state remained planning; no transition occurred. Canonical/source and installed global plugin files match; CLI instructs restart OpenCode to load updates; no restart/live runtime smoke occurred.; No smoke, full suite, build, pack, or E2E ran.
Change: none
<!-- guarana:record:end -->
