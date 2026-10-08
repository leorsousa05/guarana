# Feature spec: Guarana 1.0.0 release candidate

**Status:** VALIDATED
**Date:** 2026-10-07

## Goal

Prepare a local, unpublished Guarana `1.0.0` candidate and validate its package
and OpenCode integration against the release checklist.

## Known requirements

- The candidate version is `1.0.0`.
- Update the root `package.json` version, README version badge/status, and
  `CHANGELOG.md` together.
- Run every automated command listed by `RELEASING.md`.
- Run a provider-backed fresh OpenCode session against the packed candidate,
  recording the exact stable host version and evidence for plugins, skills,
  Task workers, workflow persistence, and uninstall cleanup.
- Do not publish the npm package or create a Git tag.

## Boundaries and assumptions

- Current source version is `0.8.6`; release notes will move the current
  Unreleased items into a dated `1.0.0` section and include the validated Task
  worker-dispatch capability.
- Existing global and project plugin/worker-profile installations are already
  current; the smoke uses isolated temporary HOME/project directories so the
  candidate is not installed into the user's real configuration.
- Release validation covers the candidate artifact and does not imply publish
  approval.

## Acceptance criteria

1. `package.json`, the README version badge/status, and `CHANGELOG.md` consistently
   identify `1.0.0`; the changelog retains prior release-readiness entries and
   includes the new native Task worker dispatch.
2. The full `RELEASING.md` automated gate passes: dashboard npm installs, audit,
   full tests, production build, CLI bundle check, specs validation, and packed
   CLI smoke. The generated archive is named `guarana-1.0.0.tgz` and excludes
   `node_modules`.
3. The packed candidate installs into an isolated prefix/project and passes a
   provider-backed fresh OpenCode session on the exact host version recorded in
   the proof. `debug config` resolves the three plugins; `debug skill` discovers
   `guarana:plan`; Task dispatch runs worker-code and worker-verify in separate
   child sessions and the workflow state persists through verification.
4. Plugin status and dashboard API smoke pass; uninstall removes the candidate's
   project skills, plugins, engines, and worker profiles while preserving files
   outside the temporary fixture.
5. Exact commands, outputs, exit statuses, host version, parent/child session
   evidence, and verifier verdict are recorded before the feature is marked
   VALIDATED. The candidate remains unpublished and untagged.

## Status

VALIDATED. The post-fix release gate, repacked candidate, fresh-project
provider-backed smoke, cleanup, and independent review all passed. The candidate
remains unpublished and untagged.

## Implementation and validation evidence

- Candidate metadata: `package.json` reports `1.0.0`; README badge/status report
  a local 1.0.0 candidate; CHANGELOG has a dated unpublished-candidate section
  plus a new Unreleased heading.
- `npm ci --prefix dashboard` — exit 0; 142 packages, audit 0 vulnerabilities.
  npm 12 warned that the esbuild postinstall script was blocked; the production
  build passed with the installed dependencies.
- `npm ci --prefix dashboard/server` — exit 0; 68 packages, audit 0
  vulnerabilities.
- `npm run audit` — exit 0; both dashboard workspaces reported zero
  vulnerabilities after lockfile updates to `proxy-addr@2.0.8` and
  `source-map-js@1.2.2`.
- `npm test` — exit 0; 214/214 tests across 43 suites.
- `npm run build` — exit 0; Vite 6.4.3 transformed 51 modules and built in
  1.26s; CLI bundle synchronized.
- `npm run check-cli` — exit 0; `CLI bundle matches canonical sources.`
- Previous `npm run specs:validate` — exit 0; 109 Markdown files, 17 feature specs,
  20 ADRs, 162 local links.
- `GUARANA_OPENCODE_SMOKE=1 npm run smoke:pack` — exit 0 after the bootstrap
  fix and again after the final changelog edit; OpenCode host smoke
  passed on 1.18.35; packed CLI smoke passed for `guarana-1.0.0.tgz` (88 files,
  no `node_modules`).
- Final candidate archive `/tmp/opencode/guarana-1.0.0.tgz` has 88 files,
  0 `node_modules` paths, size 182067 bytes, shasum
  `cde895204e560ddf4f2566e6e51397870fec14d1`, integrity
  `sha512-1tBqNg5JsZNJnUghaaMNcwYlCrUTPeD1yoBTZHHl3UifUzCZMIyqxPmwEfoA2Doev5uEeh9p9AY0JD+kMCe3Cg==`.
- Candidate installation used a temporary npm prefix and isolated HOME. The
  candidate binary reported `1.0.0`; OpenCode 1.18.35 debug config resolved
  the three plugins, debug skill discovery found `guarana:plan`, and agent list
  found all three worker subagents. Candidate plugin status reported profiles
  current. The packed candidate was uninstalled at the end; a follow-up status
  reported its plugins, engines, and profiles absent.
- Final provider-backed fresh-session command:

  ```sh
  HOME=/tmp/opencode/guarana-1.0.0-candidate-release/home XDG_DATA_HOME=/home/arch/.local/share opencode run --model openai/gpt-6-luna --format json 'Create a repository-root file named release-candidate-smoke.txt containing exactly CANDIDATE_1_0_0_OK with no trailing newline. Use a worker-code Task to create the file, then a separate worker-verify Task to independently check exact bytes and complete the workflow. Record the proof in the project .specs files.'
  ```

  OpenCode 1.18.35 completed the parent workflow with distinct Task workers.
  The marker is exactly 18 ASCII bytes `CANDIDATE_1_0_0_OK`; independent
  verification returned PASS, fresh specs validation returned `ok: true`, and
  the parent reached `completed`. Parent/child Task IDs and proof are retained in
  `release-candidate-1.0.0-smoke.jsonl`.
- Final provider-backed workflow: `new_task → plan_complete → run_start →
  coding → code_complete → verifying → verify_pass → completed`.
- Final worker-verify `ses_ee737f1aaffeL1oEwBUZ1AeEs8` — PASS, all five release
  criteria. It independently reran sequential npm installs, audit, tests
  (214/214, 43 suites), build, CLI parity, specs validation, and packed CLI
  smoke; checked final archive digest/inventory, fresh OpenCode session/Task
  evidence, uninstall, and unpublished/untagged record. Proof is in its result
  and the structured release JSONL.

## Revalidation finding (2026-10-07)

- A fresh project initialized from the packed candidate failed `guarana specs
  validate <project> --json` because generated `.specs/README.md` lacked the
  required `## Master tracker` heading. Evidence: provider smoke output
  `/home/arch/.local/share/opencode/tool-output/tool_118bec599001aEFOCOO9z8KKap`
  (worker-verify reported exit 1 and `tracker-heading`).
- Root cause: `orchestrator/specs.js` generated an incomplete tracker. Fixed by
  adding the heading and validator-required goal fields; regression test
  `fresh automatic specs bootstrap passes the shipped specs validator` was
  added and mirrored to the CLI bundle. Worker-code reported 35/35 workflow
  tests passed, `check-cli` passed, and `git diff --check` passed.
- The same pre-fix smoke's marker byte comparison passed, but the overall
  workflow verification failed on the structural gap and did not complete. It
  is not counted as release smoke acceptance. After the fix, the full gate and
  final packed-candidate smoke passed as recorded above.

Structured candidate package, host-discovery, Task-call/session, workflow-history,
and uninstall evidence is retained in
[release-candidate-1.0.0-smoke.jsonl](release-candidate-1.0.0-smoke.jsonl).
