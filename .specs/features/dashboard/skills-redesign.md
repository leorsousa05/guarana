# Feature spec: dashboard Skills redesign slice

**Status: VALIDATED**

## Goal
Redesign the dashboard Skills screen as a quiet registry/list while preserving its API and data semantics, scope/count behavior, accessible navigation, skill content, modal behavior, and responsive accessibility.

## Requirements
- Keep the existing GET /api/skills route, library behavior, response, and project/global arrays unchanged; Global remains the default and counts retain their successful-response semantics.
- Render exact skill names and descriptions; local search filters already-loaded skill names and descriptions without additional API requests.
- Preserve accessible tabs and ArrowLeft/ArrowRight/Home/End navigation, plus empty, error, and unavailable-service states.
- Preserve the read modal's close control, Escape and backdrop behavior, focus containment, focus restoration, and safe content rendering.
- Keep visible focus, reduced-motion behavior, and usable 375px and desktop layouts without unintended page-level overflow.

## Assumptions and scope
- This validation applies only to the bounded Skills redesign slice; the overall dashboard redesign remains TASKED.
- Browser API fixtures were mocked; no live generated-skill data behavior is claimed.

## Acceptance criteria
1. The existing GET /api/skills contract and project/global data meanings remain unchanged; Global is the default and counts appear with their existing successful-response semantics.
2. Accessible tabs retain their tab/panel semantics and ArrowLeft/ArrowRight/Home/End navigation; the registry shows the exact skill names and descriptions.
3. The Skills view uses a quiet registry/list presentation; raw HTML in skill content is escaped.
4. Local name/description search filters already-loaded skills while issuing the same single /api/skills request.
5. The read modal closes by control, Escape, and backdrop; focus is trapped while open and returned on close; empty and 503 states render.
6. At 375x812 and 1440x900, document/body widths match viewport widths; Skills regions measure 351px and 1116.8px; visible focus is 2px and reduced-motion duration is 1e-05s.
7. Independent browser evidence includes mobile/desktop and modal/focus/empty/error states; focused Skills test, dashboard build, and specs validation pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS (7/7) for the bounded Skills redesign slice; overall dashboard redesign remains TASKED and no shipping is claimed.; No API route or library changes; the existing GET /api/skills contract, Global default, and count semantics are preserved.; Accessible tabs support ArrowLeft/ArrowRight/Home/End; local search filters loaded skills with the same single /api/skills request.; Rendered skill content is exact and raw HTML is escaped; modal close, Escape, backdrop, focus trap, and focus return work; empty and 503 states render.; Browser metrics: document/body widths 375/375 and 1440/1440; Skills region widths 351px and 1116.8px; focus outline 2px; reduced-motion duration 1e-05s.; Screenshots: /tmp/opencode/skills-registry-verify-375x812.png and /tmp/opencode/skills-registry-verify-1440x900.png; modal/focus/empty/error screenshots were also captured, but their paths were not supplied.; Browser APIs were mocked; live generated-skill data was not exercised.; Focused Skills test PASS (1/1); dashboard build PASS (54 modules); specs validation PASS (151 files, 206 links, 0 issues).
Change: none
<!-- guarana:record:end -->
