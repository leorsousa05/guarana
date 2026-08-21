# Known Issues

Open problems and material failures from the build. Entry format: title / symptom / reproduction trigger / effective or possible mitigation / status.

_(No entries yet.)_

## 2026-08-21 — plan session skipped remember restore steps 2–3 and end-of-task state write
- **Symptom:** During the CLI feature run, the main thread restored only `.specs/README.md` (step 1) and skipped `state/project-state.md` and the ADRs; it also closed the task without the mandatory end-of-task write to `project-state.md`.
- **Reproduction trigger:** A run that starts from a tracker that looks "all done" — temptation to treat steps 2–4 as skippable.
- **Mitigation:** Restore order is "always, in this exact order" — no short-circuit even when the tracker says DONE. Detected via human audit question; state and checkpoint backfilled same day.
- **Status:** Fixed (state backfilled 2026-08-21); watch for recurrence on "green board" sessions.
