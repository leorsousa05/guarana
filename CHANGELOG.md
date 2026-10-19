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

## [1.2.0] - 2026-10-11 (unpublished candidate)

### Added
- A complete responsive redesign of the Overview, Activity, Runs, Specs,
  Workflow, Memory, Skills, and Models dashboard views.
- A shared CLI command registry and help metadata, plus pure argument parsers
  for the top-level and documented subcommands.
- Per-scope ownership manifests for installed skills, plugins, engines, worker
  profiles, and Advisor artifacts, with preservation of unrelated files.

### Changed
- CLI handlers now share awaited execution, numeric exit codes, and injectable
  stdout/stderr streams; web child processes preserve signal and exit behavior.
- `memory search --project HASH` treats `--project` as its documented filter,
  while existing global project-target selectors remain available elsewhere.
- Lifecycle operations preflight owned artifacts and roll back managed files,
  manifests, and Advisor settings after ordinary filesystem failures.
- CLI bundle synchronization preserves destination-local `node_modules`, while
  npm packaging excludes them from the published archive.

### Fixed
- Specs record paths normalize safe backslash separators without weakening
  traversal checks, and Specs document navigation keeps modal focus reliable.
- Advisor settings/profile updates are transactional; foreign or modified
  installation artifacts are preserved or refused rather than removed.
- The generated Skills registry can be searched locally by name or description.

## [1.3.0] - 2026-10-14 (unpublished candidate)

### Added
- `guarana specs record` automates fixed-file, schema-v1 specification records.
- Human-authored `.specs` records now follow category-specific filename rules
  for features, ADRs, changes, state, fixed documents, and evidence.
- Memory Graph adds Network and Neighborhood views, with explicitly confirmed
  typed relationship creation between confirmed project memories and exact
  project-only relationship removal; global graph data remains read-only.

### Changed
- Memory, orchestration, and telemetry normalize V2 lifecycle event data while
  retaining compatibility with legacy `properties` events. Lifecycle records
  use session identity rather than bus event IDs and reject missing or unknown
  session IDs.
- The specs worker consults filename conventions before selecting paths, reuses
  same-scope records, follows the documented domain fallback without arbitrary
  nesting, and preserves existing paths; convention changes require an explicit
  request.

### Fixed
- Worker-specs handoff permissions now default to deny.

## [1.3.1] - 2026-10-18 (unpublished candidate)

### Fixed
- Automatic `.specs` bootstrap creates a generic `.specs/conventions.md` for
  new projects while preserving any existing customized conventions file.

## [Unreleased]
