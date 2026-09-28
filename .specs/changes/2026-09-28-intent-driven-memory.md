# 2026-09-28 — Intent-driven project/global memory

- Injected an always-on memory policy so the model calls typed memory tools for clear durable user preferences and project decisions without a special memory command.
- Added `preference` nodes, explicit project/global scope, private user-vault initialization, scoped search/context, and supersession-aware global preference retrieval.
- Orchestrator now injects standing global preferences on each task and relevant project context separately.
- Global preferences are loaded on every turn, including idle/non-task turns, but the same node IDs are injected only once per session unless context compacts or new memories become relevant.
- Ordinary task text and raw tool/file activity still create no memory nodes.
- Saved this request as a global user preference and a separate project decision using the installed plugin tool.
- Verification: `npm test` 175/175, `npm run build`, `npm run check-cli`; global and project plugin installs completed.
