# ADR-009 — Pluggable embeddings: built-in TF-IDF default, optional local provider

**Status:** Accepted (2026-08-30) · append-only

## Context
The memory feature requires hybrid search: semantic similarity via "lightweight, locally-runnable embeddings" plus structural tag filters. The root package is deliberately dependency-free (ADR-001-era constraint: CLI is stdlib-only). Pulling in an ONNX/transformer runtime (transformers.js, fastembed) would break that constraint and add a model download on first use.

## Decision
Semantic search uses a **pluggable provider** interface:
1. **Default: built-in TF-IDF** over node text (intent/summary/tags), implemented in stdlib JS, zero dependencies, fully local.
2. **Optional provider**: if the vault config names an embedding provider (interface: `embed(text) → number[]`), the engine loads it and ranks by cosine similarity. Providers are never bundled; the user installs/configures one explicitly.

Structural filters (memory type, project, date range, author, status) are always applied first; semantic ranking orders the remainder.

## Tradeoffs
- TF-IDF is weaker than true embeddings on paraphrases, but keeps the zero-dependency guarantee and works offline with no model download.
- The provider seam keeps the door open to real embeddings without engine changes.

## Consequence
Recorded in `.specs/features/memory/memory.md` (Slice 1 search engine). Answered via Rule 0 (2026-08-30).
