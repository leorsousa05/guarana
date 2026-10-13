# Feature spec: Activity dashboard at-a-glance reorganization

**Status: IMPLEMENTED**

## Goal
Reorganize Activity dashboard presentation to prioritize valuable and useful information at a glance rather than exhaustive lists.

## Requirements
- Retain meaningful current root-session information.
- Retain workflow state and task.
- Retain Advisor latest status, reason, and configured-versus-observed model comparison.
- Retain recent tool/session evidence and injected-memory evidence.
- Change the layout of the sections to prioritize high-signal information.
- Keep the scope to frontend presentation; preserve API/data contracts and existing safety/accessibility behavior.

## Assumptions and scope
- Reversible assumption: use a compact desktop-first overview with concise/high-signal summaries and limited recent evidence; do not claim all data literally fits at every viewport.
- Detailed history remains reachable through the existing Advisor history/modal or existing controls.
- Activity dashboard frontend presentation only.
- Preserve responsive narrow layouts and existing safety/accessibility behavior.
- No API or data-contract changes.
- Bound verbose Workflow task metadata (goal and condition) and transition notes in the primary layout; make their full text reachable through nested disclosure without losing data. Do not require bounding the Active task field or Advisor reason.

## Acceptance criteria
1. Reorganized page prioritizes key active/current data.
2. Nonessential exhaustive lists are not dominant.
3. All important evidence sections remain reachable.
4. Existing contracts/tests pass, the 375px layout passes, and the page has no horizontal overflow.
5. Dashboard build passes.
6. Representative verbose Workflow task metadata (goal and condition) and transition notes do not create an excessively large primary Activity layout; the full text remains reachable through nested disclosure, and the page has no horizontal overflow. This criterion does not require bounding the Active task field or Advisor reason.
7. Focused tests and dashboard build pass. This does not resolve the existing rendered 375px browser-verification blocker; do not claim full-feature validation until that proof is available.

<!-- guarana:record:start -->
Status: IMPLEMENTED
Proof: Focused 30 tests passed.; Dashboard build passed.; Distribution build regenerated.
Change: none
<!-- guarana:record:end -->
