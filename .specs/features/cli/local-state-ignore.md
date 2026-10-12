# Feature spec: Ignore local Advisor and workflow state

**Status: VALIDATED**

## Goal
Ignore and untrack the local Advisor settings and operational workflow state while preserving both files on disk.

## Requirements
- The root .gitignore has root-anchored ignore entries for .guarana/advisor.json and .specs/state/workflow.json.
- Both files are tracked before this change; remove them from the Git index without deleting their local copies.
- Do not generalize ignore rules to other paths.

## Assumptions and scope
- .gitignore
- .guarana/advisor.json
- .specs/state/workflow.json

## Acceptance criteria
1. Both .guarana/advisor.json and .specs/state/workflow.json exist locally after the change.
2. git check-ignore -v matches both local files to their root-anchored ignore entries.
3. git ls-files tracks neither .guarana/advisor.json nor .specs/state/workflow.json.
4. No other paths are generalized by the ignore rules.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall PASS.; guarana specs validate . --json: ok true, 162 files, 0 issues.; Root-anchored .gitignore entries at lines 47-48; git check-ignore -v matched both requested paths.; git ls-files lists neither requested path; both local files exist.; Git status shows .gitignore modified and index deletions only; local contents are preserved.; No commit or push was made.
Change: none
<!-- guarana:record:end -->
