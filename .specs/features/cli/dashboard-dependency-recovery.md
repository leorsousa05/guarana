# Feature spec: Dashboard Dependency Recovery

**Status: VALIDATED**

## Goal
Make guarana web detect and repair incomplete dashboard server dependency installs before starting Express.

## Requirements
- Current web command skips installation whenever node_modules exists.
- Dashboard server lock pins Express whose body-parser/raw-body dependency iconv-lite@0.4.24 requires package-root encodings; user observed Cannot find module ../encodings after npm install --omit=dev.

## Assumptions and scope
- The dashboard server package-lock is authoritative.
- Recovery may use npm ci --omit=dev to recreate the local dependency tree.
- Validate critical server dependencies actually load before spawn.
- Run a clean locked install for missing or corrupt dependencies and verify again before startup.
- Add focused regressions and packed CLI smoke coverage.

## Acceptance criteria
1. Dependency health probe catches missing or incomplete iconv-lite encoding module even when node_modules exists.
2. Unhealthy tree runs npm ci --omit=dev and web starts only after successful post-install health check, otherwise exits with actionable error.
3. Tests cover complete, missing and corrupt dependency cases and repair invocation.
4. Packed CLI smoke verifies dashboard health endpoint after a clean install.
5. npm test, check-cli, specs validation and diff-check pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: worker-verify ses_ede9829a6ffeVijrN3ogchiRdd — PASS (4/4); npm test — PASS (280/280); npm run check-cli — PASS; npm run specs:validate — PASS (135 Markdown, 24 features, 30 ADRs, 208 links); git diff --check — PASS; npm run smoke:pack — PASS (guarana-1.1.0.tgz, 99 files, no node_modules); dashboard health endpoint returned successfully; known issue iconv-lite encodings marked resolved by worker-debug
Change: none
<!-- guarana:record:end -->
