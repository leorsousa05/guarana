# Change 2026-10-07 — Guarana 1.0.0 release candidate

## Change

Prepared a local, unpublished `1.0.0` candidate. The root package version,
README version badge/status, and changelog agree; dashboard lockfiles were
patched to remove newly reported advisories. Packed candidate installation and
the provider-backed OpenCode host smoke ran in isolated temporary prefix,
project, and HOME locations. No publish or Git tag was performed.

## Automated release gate

- `node --version` — `v24.20.0`; `npm --version` — `12.2.0`.
- `npm ci --prefix dashboard` — exit 0; 142 packages, 0 audit findings. npm 12
  warned that the esbuild install script was blocked; production build passed.
- `npm ci --prefix dashboard/server` — exit 0; 68 packages, 0 audit findings.
- `npm audit fix --prefix dashboard` and `npm audit fix --prefix dashboard/server`
  — exit 0; patched `proxy-addr` to 2.0.8 and `source-map-js` to 1.2.2.
- `npm run audit` — exit 0; both dashboard workspaces reported 0 vulnerabilities.
- `npm test` — initial release gate 213 passed; post-fix revalidation 214 passed, 0 failed, across 43 suites.
- `npm run build` — exit 0; Vite 6.4.3 transformed 51 modules, production build
  passed, and the canonical CLI bundle synchronized.
- `npm run check-cli` — exit 0; `CLI bundle matches canonical sources.`
- `npm run specs:validate` — exit 0; 109 Markdown files, 17 feature specs,
  20 ADRs, 162 local links.
- `GUARANA_OPENCODE_SMOKE=1 npm run smoke:pack` — exit 0; OpenCode 1.18.35
  host smoke passed; packed CLI smoke passed for `guarana-1.0.0.tgz` (88 files,
  no `node_modules` paths).
- Final `npm pack --pack-destination /tmp/opencode --json` — produced
  `/tmp/opencode/guarana-1.0.0.tgz`, 88 files, 0 `node_modules` paths,
  182067 bytes; shasum `cde895204e560ddf4f2566e6e51397870fec14d1`.

## Earlier provider-backed OpenCode smoke (previous archive)

- Host version: OpenCode `1.18.35`.
- The packed candidate was installed in an isolated npm prefix and project; its
  binary reported `1.0.0`.
- `opencode debug config` resolved all three plugins; `opencode debug skill`
  discovered `guarana:plan`; `opencode agent list` discovered worker-code,
  worker-verify, and worker-debug.
- `guarana plugin status --project` reported plugins, engines, and profiles
  current. `GUARANA_OPENCODE_SMOKE=1 npm run smoke:pack` exercised packed
  dashboard startup/API. Candidate uninstall removed the project skills,
  plugins, engines, and worker profiles; follow-up status reported them absent.
- Fresh `opencode run --model openai/gpt-6-luna` completed a provider-backed
  Task workflow. worker-code created `release-smoke.txt`; independent
  worker-verify passed after a temporary task-record byte-count error (24-byte
  literal documented as 25) was diagnosed and corrected through worker-debug.
  The final exact-byte check passed and the parent workflow reached `completed`.
  Parent/child Task calls, IDs, outputs, and final byte proof are retained in
  `.specs/features/release/release-candidate-1.0.0-smoke.jsonl`.
- Candidate remains unpublished and untagged.

## Post-fix final-candidate revalidation

- Fresh-project smoke exposed an incomplete generated `.specs/README.md` (missing `## Master tracker`); the validator rejected the scaffold. `ensureSpecs()` now emits the required heading and goal fields, with a regression test that invokes the shipped CLI validator. The CLI bundle was synchronized.
- Full release gate rerun after the code fix: sequential dashboard `npm ci` installs passed (142 and 68 packages, zero vulnerabilities); `npm run audit` passed with zero vulnerabilities; `npm test` passed 214/214 across 43 suites; `npm run build`, `npm run check-cli`, and `npm run specs:validate` passed; `GUARANA_OPENCODE_SMOKE=1 npm run smoke:pack` passed on OpenCode 1.18.35 (88 files, no `node_modules`). The final `smoke:pack` was repeated after the changelog update.
- Final archive: `/tmp/opencode/guarana-1.0.0.tgz`, 182067 bytes, 630466 unpacked bytes, 88 files, zero `node_modules` paths, shasum `cde895204e560ddf4f2566e6e51397870fec14d1`, integrity `sha512-1tBqNg5JsZNJnUghaaMNcwYlCrUTPeD1yoBTZHHl3UifUzCZMIyqxPmwEfoA2Doev5uEeh9p9AY0JD+kMCe3Cg==`.
- Installed that archive in an isolated npm prefix/project. OpenCode `1.18.35` resolved the three Guarana plugins, discovered `guarana:plan` and worker-code/worker-verify/worker-debug. Plugin status was current before uninstall; all plugins, engines, skills, and worker profiles were absent after uninstall.
- Fresh provider-backed session used `openai/gpt-6-luna`; parent `ses_ee73bbdbfffeplG3PVf9bf0x17`; worker-code child `ses_ee73b4140ffeCrmQQcMxb96QnW`; worker-verify child `ses_ee73ae572ffeMfb041Q7gOoIFs`. Independent verification returned PASS for the exact 18-byte marker; specs validation returned `ok: true`; parent workflow reached `completed`. Detailed calls, output, and cleanup are in `features/release/release-candidate-1.0.0-smoke.jsonl`.
- Independent worker-verify `ses_ee737f1aaffeL1oEwBUZ1AeEs8` returned PASS on all five final criteria after independently rerunning the full automated release gate, checking final archive metadata/inventory, validating the JSONL, and reviewing the post-fix provider-backed smoke and cleanup evidence.
- Final release-record consistency review: worker-verify `ses_ee736126bffe4DsGuwmqwwrXQQ` returned PASS; confirmed VALIDATED status, matching digest/session records, valid specs/JSONL, clean diff, and `published:false` / `tagCreated:false`.
- No package publish or Git tag was performed; publishing/tagging remains a separate maintainer action.
- Independent worker-verify — PASS, all five criteria for the previous
  archive only. It reran
  the tests, audit, production build, CLI check, specs validation, and diff
  check; it confirmed the packed archive and provider-backed host evidence.
- Candidate remains unpublished and untagged.
