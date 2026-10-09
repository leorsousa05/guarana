# ADR-028 — Live Activity view and Advisor history

**Status:** Accepted (2026-10-08) · append-only

## Context

The current Now view is a compact run summary, while workflow state and injected
memory live on separate screens. Users want one place to watch work as it
happens, with the current session and Advisor presented as clear visual peers.
They also want past Advisor calls available from a history button without
cluttering the Models configuration form with runtime proof.

## Decision

1. Recast the existing `#/now` view as **Activity**, preserving the URL/hash for
   existing links while changing the visible navigation label.
2. Lead with two square, rule-led panels: current root session and Advisor. Choose
   a root with observed busy/running status first; if none is busy, choose the root
   with the latest recorded activity time. A session is “active/running” only when
   telemetry reports busy/running; otherwise label it “latest” or “last seen”.
3. Show workflow phase/transition flow, safe recent tool events, and the actual
   injected memories for the selected root session beneath the panels. Use
   existing SSE updates and the memory-injections API.
4. The Advisor panel shows the latest status/observed runtime metadata and offers
   an Advisor history button. History opens an accessible modal using sanitized
   `advisor-execution` events only. Never show prompts, raw model responses, raw
   tool-error strings, or credentials in the activity timeline/history.
5. Models remains the configuration surface; remove the runtime-proof panel from
   Models when Activity becomes the live execution surface.
6. Preserve the ledger palette, square geometry and hairline rules; peer panels
   stack at 375px without horizontal page overflow.

## Alternatives considered

- A new independent view plus a second duplicate Now summary — rejected to keep
  existing `#/now` links and avoid duplicating the current-session surface.
- Rounded generic dashboard cards — rejected in favor of the established ledger
  identity and the user's request for clear square work areas.
- Put Advisor history inside Models — rejected because Models is for editing
  provider/model configuration, while execution history belongs with Activity.
- Display raw Task/error/prompt payloads in the timeline — rejected; show only
  safe event summaries and hydrated memory references.

## Consequences

- Activity needs parent/root session identification and safe status/tool summaries
  in telemetry, plus a bounded Advisor-history API and accessible modal.
- The current session panel must distinguish observed busy state from a merely
  recent/last-seen session.
- Tests must cover SSE refresh, current root vs Advisor child, modal close/focus,
  safe history content, memory injection, and 375px layout.
