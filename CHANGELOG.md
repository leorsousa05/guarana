# Changelog

Notable user-facing changes to Guarana are recorded here. A version heading may
describe a locally validated, unpublished candidate; publication is a separate
maintainer action.

## [1.0.0] - 2026-10-07 (unpublished candidate)

### Added
- A Node.js support policy and CI coverage for Node 22.x and 24.x.
- A release checklist for validating the packed CLI and its OpenCode integration.
- An MIT license file included in the npm package.
- Native OpenCode Task subagents for implementation, independent verification,
  and failure diagnosis, with safe project/global worker-profile installation.
- Automatic creation and dashboard inventory of reusable project/global skills.

### Changed
- Guarana 1.0 requires Node.js 22 or newer.
- The dashboard toolchain uses patched Vite 6 and updates vulnerable transitive
  dashboard dependencies.
- CLI bundle generation omits local `node_modules`; the dashboard server installs
  its locked production dependency only when the dashboard is first run.
- Project-local skills install under OpenCode's `.opencode/skills/` directory.
- The workflow orchestrator dispatches code, verification, and debug work to
  separate Task contexts while preserving parent-owned workflow state.

### Fixed
- npm package contents are checked for accidental dependency-directory inclusion,
  and the installed tarball is exercised through CLI and dashboard startup in an
  isolated smoke test.
- The published CLI resolves its skills, plugins, engines, and dashboard from the
  bundled package instead of looking for source directories outside the tarball.
- Task child sessions no longer re-plan or advance the parent workflow, and
  duplicate global/project plugin hooks process a parent message once.
- Newly bootstrapped project specifications include the required master tracker
  and goal fields, so the shipped validator accepts a fresh project.

## [Unreleased]

Future changes will be recorded here.
