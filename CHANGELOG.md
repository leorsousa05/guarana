# Changelog

Notable user-facing changes to Guarana are recorded here. The current package
version remains the published release; unreleased work is listed separately.

## [Unreleased]

### Added
- A Node.js support policy and CI coverage for Node 22.x and 24.x.
- A release checklist for validating the packed CLI and its OpenCode integration.
- An MIT license file included in the npm package.

### Changed
- The next release requires Node.js 22 or newer.
- The dashboard toolchain uses patched Vite 6 and updates vulnerable transitive
  dashboard dependencies.
- CLI bundle generation omits local `node_modules`; the dashboard server installs
  its locked production dependency only when the dashboard is first run.
- Project-local skills install under OpenCode's `.opencode/skills/` directory.

### Fixed
- npm package contents are checked for accidental dependency-directory inclusion,
  and the installed tarball is exercised through CLI and dashboard startup in an
  isolated smoke test.
- The published CLI resolves its skills, plugins, engines, and dashboard from the
  bundled package instead of looking for source directories outside the tarball.
