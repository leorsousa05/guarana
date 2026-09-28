# 2026-09-27 — Remove generic completion records from memory

- Removed the orchestrator's automatic `memorySaveDecision` call on verified workflow completion.
- Added regression coverage proving completion leaves existing durable memory unchanged.
- Removed the legacy generic completion marker from the project vault.
- Verification: `npm test`, `npm run build`, `npm run check-cli`.
