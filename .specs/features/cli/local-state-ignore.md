# Feature spec: Ignore local Advisor and workflow state

**Status: SHIPPED**

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
Status: SHIPPED
Proof: Commit 99ea06b (chore(gitignore): ignore local Advisor and workflow state) is on origin/main; HEAD equals origin/main at 99ea06b.; Independent worker-verify PASS confirmed the commit contains only intended .gitignore rules, index removals, and spec bookkeeping.; Both local files remain present, ignored, and untracked; working tree is clean.; Specs validator: 162 files, 0 issues.; User explicitly authorized commit and push.
Change: none
<!-- guarana:record:end -->
