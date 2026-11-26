# Feature spec: Guarana Portuguese documentation site

**Status: SHIPPED**

## Goal
Extend the existing PT-BR Guarana landing site into a comprehensive static documentation portal while preserving the landing page's recognizable visual and structural design. Keep the standalone React/Vite app and existing GitHub Pages delivery.

## Requirements
- Preserve the existing landing page's hero/illustration, copy, palette, and sections; add accessible entry links to documentation and examples.
- Add PT-BR multipage documentation with a Docusaurus-like topic sidebar, deep-link navigation, and lightweight local search. This describes the user experience, not a request to replace React/Vite with Docusaurus.
- Cover start here, installation, quick start, update, uninstall, all CLI command families and flags from canonical README/CLI metadata, automatic lifecycle, recovery/debug/explicit skills, all skills in the current canonical index, memory scopes/persistence/injection/safety, local Dashboard surfaces/configuration, security/privacy/troubleshooting, architecture/repository layout/OpenCode integration, developer setup/build/test/check-cli/contribution, and Pages instructions.
- Provide practical examples with natural-language task prompts and CLI/configuration snippets. Keep current release and installation details accurate, link to canonical repository Markdown and https://github.com/leorsousa05/guarana.git, and treat repository sources as canonical.
- Keep the site static under docs-site/, using the existing React/Vite app, /guarana/ base, and Pages workflow. Do not modify Dashboard/runtime behavior, root CI, or root package configuration; do not perform an external deployment.
- The site is responsive and keyboard-operable, with accessible navigation and no horizontal page overflow on mobile or desktop.

## Assumptions and scope
- Retain the existing standalone React/Vite docs-site and its GitHub Pages base/workflow; “Docusaurus-like” is a UX reference, not a framework migration.
- The root README.md, CLI command metadata/help, docs/reference files, current skills index and skill files, Dashboard route/config sources, and repository Markdown are factual sources; link back to canonical repository sources instead of superseding them.
- The local operational Dashboard remains separate from the public documentation site.
- Scope includes preserving the validated landing page and adding the expanded documentation and examples portal; it excludes Dashboard/runtime, root CI/package configuration, and external deployment.
- Use ADR-005 default budgets: worker-code 8k tokens, worker-verify 4k tokens per dispatch, and a 32k-token / 15-minute per-run cap.

## Acceptance criteria
1. The existing landing page retains its recognizable hero/illustration, copy, palette, and sections, and exposes accessible, working links to documentation and examples.
2. The static portal presents topic-based sidebar navigation, directly addressable/deep-linked pages, lightweight local search, and responsive keyboard-operable navigation at mobile and desktop viewports.
3. PT-BR pages cover installation, quick start, update, uninstall, all canonical CLI command families and flags, lifecycle/recovery/debug/explicit skills, every skill in the current canonical index, memory scopes/persistence/injection/safety, local Dashboard surfaces/configuration, security/privacy/troubleshooting, architecture/repository layout/OpenCode integration, developer setup/build/test/check-cli/contribution, and Pages instructions.
4. Practical PT-BR examples include natural-language task prompts and accurate actionable CLI/configuration snippets; internal links resolve locally and repository-source links point to canonical Markdown and repository targets.
5. Current release and installation details match canonical sources; the React/Vite static build emits deployable assets under docs-site/dist whose URLs resolve with the /guarana/ base path.
6. The existing Pages workflow remains limited to push on main, builds the docs-site app, uses only Pages publication permissions, and publishes only docs-site/dist; no external deployment is performed.
7. The change does not modify the operational Dashboard, runtime behavior, existing CI, or root package configuration.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: Source commit 1d59f50ac43225f6e83a99b0c2ba0caa6cd6cb69 was pushed normally with git push origin main; output was c8db86b..1d59f50 main -> main, and git ls-remote origin refs/heads/main matched the commit exactly.; GitHub Actions pages.yml run 45770675767 completed with conclusion success for event push at headSha 1d59f50ac43225f6e83a99b0c2ba0caa6cd6cb69; https://github.com/leorsousa05/guarana/actions/runs/45770675767; created 2026-11-26T06:47:44Z.; Live https://leorsousa05.github.io/guarana/ returned HTTP/2 200 and title Guarana — engenharia em ciclo para OpenCode; deployed /guarana/assets/index-B08RkM6x.js, /guarana/assets/index-rAHiKM16.css, and /guarana/guarana.png each returned HTTP 200.; npm run build --prefix docs-site passed before source commit with Vite 6.4.6, generating dist/index.html and assets; the commit included .github/workflows/pages.yml, .specs/README.md documentation-site row and task-related NEXT sentence only, ADR-051, this feature record, and docs-site/**.; No force push, package release, tag, GitHub release, or formal package deployment occurred.
Change: none
<!-- guarana:record:end -->
