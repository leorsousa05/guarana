# Feature spec: Diagnose and correct reusable skill-capture under-firing

**Status: VALIDATED**

## Goal
Diagnose why Guarana reusable skills are created infrequently and correct the capture trigger or implementation only if evidence shows it is under-firing.

## Requirements
- Broaden always-on skill-capture guidance beyond only explicit user-provided checklists or corrections.
- After completing a task, assess whether reusable workflow, project knowledge, or context should be captured for future tasks.
- Treat recurring explanations of application architecture or components and operational guidance on how to work with them as positive skill-capture signals when future reuse is clear.
- Retain exclusions for one-off work and technical complexity alone; continue distinguishing durable preferences or decisions from reusable procedures.
- Check existing Guarana skills in both global and project scopes before creation, avoid duplicates, select the appropriate scope, and preserve secret and privacy protections.
- Keep changes limited to injected capture-decision policy, matching guarana:memory guidance, focused policy tests, synchronized copies, and this feature plan; change tools, engine, or dashboard behavior only if evidence requires it.

## Assumptions and scope
- Whether the current policy or implementation is under-firing has not yet been established; diagnose before choosing a correction.
- Inspect the memory plugin's injected skill-capture policy and focused policy tests.
- Align the canonical and CLI copies of the relevant guidance and policy artifacts.
- Do not change skill tools, engine, or dashboard unless diagnosis provides evidence that such a change is necessary.

## Acceptance criteria
1. The injected policy explicitly requires an after-task assessment for reusable workflow, project knowledge, and context, rather than limiting capture to explicit checklists or corrections.
2. The policy identifies recurring explanations of application architecture or components and how to work with them as positive examples when they will help future similar tasks.
3. One-off work and complexity-only remain non-triggers; duplicate checking across both scopes, scope selection, and secret/privacy protections remain explicit.
4. The guarana:memory skill gives guidance consistent with the injected policy, and focused tests prove the injected policy contains the new positive triggers and retained exclusions.
5. Canonical and CLI copies are synchronized, and focused checks show existing skill-engine behavior remains unchanged; tool, engine, or dashboard changes are made only if diagnosis demonstrates a need.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify verdict: PASS for all acceptance criteria.; plugin/guarana-memory.js:22-32 implements post-task reuse assessment including application architecture, components, and how-to guidance.; plugin/guarana-memory.test.mjs:53-87 asserts the new triggers and one-off/complexity exclusions, memory-versus-skill distinction, duplicate checks, and scope.; skills/guarana/skills/memory/SKILL.md:42-63 matches the runtime policy.; plugin/guarana-memory.test.mjs:155-223 covers project/global skill creation and listing, cross-scope duplicate refusal without overwrite, and secret rejection.; node bin/guarana.js specs validate . --json — PASS; ok:true, 140 files, zero issues.; node --test plugin/guarana-memory.test.mjs — PASS (9/9).; npm run check-cli — PASS; bundle matches.; Direct canonical/CLI byte comparisons — PASS; exact comparison command was not included in the handoff.; git diff --check — PASS.; Independent verifier confirms the code diff leaves engine and dashboard behavior unchanged.; Limitation: static policy/tool verification only; no live-model capture-rate test. User did not confirm shipping.
Change: none
<!-- guarana:record:end -->
