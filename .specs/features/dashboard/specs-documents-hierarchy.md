# Feature spec: Dashboard Specs Documents Hierarchy

**Status: VALIDATED**

## Goal
Replace rejected flat Documents labels with a compact, human-readable, expandable hierarchy that organizes the non-state Specs documents while preserving existing Documents interactions and accessibility.

## Requirements
- Use a small set of top-level collections: Decisions, Changes, Features, and Foundations; show Other only when unmatched documents need it.
- Expand Changes into human-readable month groups ordered newest first, with dated change documents beneath each month.
- Expand Features as a directory hierarchy using local child names, such as Dashboard and Guarana containing Audits and Proofs, instead of repeating flat path prefixes.
- Order Decisions ADR documents newest first and put root-level documents only under Foundations.
- If archive/README.md is the archive's only entry and is merely its empty index, omit it and do not show an Archive collection; show a top-level Archive collection when real archived artifacts exist.
- Show every other non-state document exactly once, including documents from unfamiliar directories under Other.
- Keep hierarchy groups collapsed by default, expanding the ancestry of the active document and groups matching search.
- Preserve Documents search, selected-document reader behavior, local document links, ARIA/accessibility, and mobile usability; make no API changes.

## Assumptions and scope
- Dashboard Specs Documents frontend hierarchy and its regression/acceptance tests.
- No server, API, or data-schema changes.

## Acceptance criteria
1. The rendered Documents tree has the intended nested top-level collections and actual directory/month subgroups, with local child labels and no repeated flat prefixes.
2. Changes month groups have human-readable labels in newest-first order, dated documents are nested under the correct month, and Decisions ADRs are newest first; Foundations contains root documents only.
3. A fixture where archive/README.md is the only archive entry renders no archive placeholder or Archive collection, while a fixture with real archived artifacts renders a top-level Archive collection.
4. A tree coverage test proves every non-state document appears exactly once, except the empty archive index placeholder; unfamiliar directory documents remain visible under Other.
5. Groups start collapsed except active-document ancestry and search matches; search result counts correspond to unique matching documents and search retains its existing behavior.
6. Selecting documents and following local document links still opens the correct reader content; ARIA relationships, keyboard accessibility, and visible focus remain intact.
7. At a 375px viewport the Documents hierarchy and reader have no unintended horizontal overflow.
8. Acceptance tests exercise the actual nested group tree, both archive cases, complete path coverage, search counts, and the 375px no-overflow condition; no API changes are made.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS: top-level Decisions (30), Changes (64), Features (69), Foundations (5); Changes has human-readable month groups newest-first; Features is hierarchical with Guarana containing Audits and Proofs; exactly four top-level groups, no flat prefixes or duplicate Features; empty archive README omitted; all 168 documents appear exactly once.; Search, selection, reader, ARIA, and focus behavior pass; at 375px clientWidth, scrollWidth, and body width are all 375.; Docs+Specs tests PASS (12/12; exact command not supplied); npm run build PASS; npm run check-cli PASS.; Screenshots: /tmp/opencode/specs-documents-expanded-desktop.png and /tmp/opencode/specs-documents-mobile-375.png.; Shipping was not confirmed; status remains VALIDATED, not SHIPPED.
Change: none
<!-- guarana:record:end -->
