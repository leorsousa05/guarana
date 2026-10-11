import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = (name) => fs.readFileSync(path.join(webRoot, 'src/components', name), 'utf8');
const render = (element) => renderToStaticMarkup(element);

test('Specs Overview preserves tracker links, priority roadmap, and project-state reading actions', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Specs } = await vite.ssrLoadModule('/src/components/Specs.jsx');
  const html = render(React.createElement(Specs, {
    tracker: {
      schema: 'guarana',
      rows: [{
        skill: 'guarana:specs', status: 'VALIDATED',
        proof: '[verification](features/dashboard/proofs/specs.md)',
        change: '[redesign](changes/2026-10-10-specs.md)',
      }],
      BLOCKED: ['Waiting for the design review.'],
      NEXT: ['Run Specs viewport checks.'],
      DONE: ['Keep the tracker evidence.'],
    },
    state: { projectState: '# Current work\n\nKeep the implementation reviewable.', knownIssues: '## Open issue\n\nNone recorded.' },
  }));

  assert.match(html, /Implementation tracker/);
  assert.match(html, /guarana:specs/);
  assert.match(html, /VALIDATED/);
  assert.match(html, /class="md-link">verification<\/button>/);
  assert.match(html, /class="md-link">redesign<\/button>/);
  assert.match(html, /BLOCKED roadmap items/);
  assert.match(html, /NEXT roadmap items/);
  assert.match(html, /DONE roadmap items/);
  assert.match(html, /Waiting for the design review\./);
  assert.match(html, /Run Specs viewport checks\./);
  assert.match(html, /Keep the implementation reviewable\./);
  assert.match(html, /known-issues\.md/);
  assert.match(html, /Read full text/);
});

test('Specs keeps Unknown-schema, loading, empty-roadmap, and state-only Overview content', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Specs } = await vite.ssrLoadModule('/src/components/Specs.jsx');

  const unknown = render(React.createElement(Specs, {
    tracker: { schema: 'unknown', rows: [], message: 'External schema is not renderable.' },
    state: { projectState: 'Overview state remains visible.', knownIssues: 'No known issues.' },
  }));
  assert.match(unknown, /External schema is not renderable\./);
  assert.doesNotMatch(unknown, /spec-roadmap-title/);
  assert.match(unknown, /Overview state remains visible\./);

  const loading = render(React.createElement(Specs, { tracker: null, state: null }));
  assert.match(loading, /role="status">loading tracker…/);
  assert.match(loading, /role="status">loading pending decisions…/);
  assert.match(loading, /role="status">loading documents…/);
  assert.doesNotMatch(loading, /spec-roadmap-title/);

  const emptyRoadmap = render(React.createElement(Specs, {
    tracker: { schema: 'guarana', rows: [], BLOCKED: [], NEXT: [], DONE: [] },
    state: { projectState: '', knownIssues: '' },
  }));
  assert.match(emptyRoadmap, /no tracker rows/);
  assert.match(emptyRoadmap, /No roadmap items recorded\./);
});

test('Specs decision queue presents pending actions, states, and documents file-wide resolution limits', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { PendingDecisionQueue, postDecisionResolution } = await vite.ssrLoadModule('/src/components/Specs.jsx');
  const decision = { file: '.specs/decisions/ADR-090-example.md', statement: 'Should the record keep this action?' };
  const queue = (props = {}) => render(React.createElement(PendingDecisionQueue, {
    decisions: [decision], error: null, loading: false, resolving: null, resolution: null,
    onRead() {}, onResolve() {}, ...props,
  }));
  const html = queue();
  assert.match(html, /Decisions needing you/);
  assert.match(html, /Should the record keep this action\?/);
  assert.match(html, /ADR-090-example\.md/);
  assert.match(html, />Accept<\/button>/);
  assert.match(html, />Reject<\/button>/);
  assert.match(html, /file-wide: resolving one item in a file can hide every pending decision/);

  const saving = queue({ resolving: JSON.stringify([decision.file, decision.statement]) });
  assert.match(saving, /Saving…/);
  assert.match(saving, /disabled=""/);
  assert.match(queue({ resolution: { type: 'success', text: 'Decision accepted.' } }), /role="status">Decision accepted\./);
  assert.match(queue({ resolution: { type: 'error', text: 'Unable to reject decision.' } }), /role="alert">Unable to reject decision\./);
  assert.match(render(React.createElement(PendingDecisionQueue, { decisions: [], error: null, loading: false })), /No open decisions\./);
  assert.match(render(React.createElement(PendingDecisionQueue, { decisions: null, error: 'network failure', loading: false })), /Unable to load pending decisions: network failure/);

  let requestDetails;
  await postDecisionResolution(decision.file, decision.statement, 'accepted', async (...args) => {
    requestDetails = args;
    return { ok: true, async json() { return { ok: true }; } };
  });
  assert.equal(requestDetails[0], '/api/decisions/resolve');
  assert.equal(requestDetails[1].method, 'POST');
  assert.equal(requestDetails[1].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(requestDetails[1].body), { ...decision, outcome: 'accepted' });
  await assert.rejects(
    postDecisionResolution(decision.file, decision.statement, 'rejected', async () => ({
      ok: false, status: 409, statusText: 'Conflict', async json() { return {}; },
    })),
    /409 Conflict/
  );

  const specsSource = readSource('Specs.jsx');
  assert.match(specsSource, /usePoll\('\/api\/decisions\/pending'/);
  assert.match(specsSource, /pending\.refetch\(\)/);
  assert.match(specsSource, /onResolve\(decision\.file, decision\.statement, 'accepted'\)/);
  assert.match(specsSource, /onResolve\(decision\.file, decision\.statement, 'rejected'\)/);
});

test('Specs tabs keep reciprocal tab-panel IDs and support arrow, Home, and End navigation', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Specs } = await vite.ssrLoadModule('/src/components/Specs.jsx');
  const { handleTabKeyDown } = await vite.ssrLoadModule('/src/components/common.jsx');
  const html = render(React.createElement(Specs, { tracker: { schema: 'guarana', rows: [], BLOCKED: [], NEXT: [], DONE: [] }, state: {} }));

  for (const [tab, panel] of [['overview', 'overview'], ['documents', 'documents']]) {
    assert.match(html, new RegExp(`id="spec-tab-${tab}"[^>]*aria-controls="spec-panel-${panel}"`));
    assert.match(html, new RegExp(`id="spec-panel-${panel}" role="tabpanel" aria-labelledby="spec-tab-${tab}"`));
  }
  assert.match(html, /role="tablist" aria-label="Specs views"/);

  for (const [key, current, expected] of [
    ['ArrowRight', 'overview', 'documents'], ['ArrowLeft', 'overview', 'documents'],
    ['Home', 'documents', 'overview'], ['End', 'overview', 'documents'],
  ]) {
    let selected;
    let focused;
    const event = {
      key,
      target: { closest: () => ({ dataset: { tabId: current } }) },
      currentTarget: { querySelector: (selector) => ({ focus() { focused = selector; } }) },
      preventDefault() { this.prevented = true; },
    };
    handleTabKeyDown(event, ['overview', 'documents'], (value) => { selected = value; });
    assert.equal(selected, expected, `${key} selects ${expected}`);
    assert.equal(focused, `[data-tab-id="${expected}"]`);
    assert.equal(event.prevented, true);
  }
});

test('Documents excludes state, retains unknown directories, searches titles/paths, and opens the selected file', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Documents, buildGroups, filterDocumentGroups } = await vite.ssrLoadModule('/src/components/Documents.jsx');
  const tree = [
    'state/project-state.md', 'state/known-issues.md',
    'decisions/ADR-012-second.md', 'decisions/ADR-003-first.md',
    'features/dashboard/dashboard.md', 'shared/foreign/guide.md',
  ];
  const groups = buildGroups(tree);
  const allPaths = groups.flatMap((group) => group.items);
  assert.equal(allPaths.includes('state/project-state.md'), false);
  assert.equal(allPaths.includes('state/known-issues.md'), false);
  assert.ok(allPaths.includes('shared/foreign/guide.md'));
  assert.deepEqual(groups.find((group) => group.key === 'decisions').items, ['decisions/ADR-003-first.md', 'decisions/ADR-012-second.md']);

  const titles = {
    'decisions/ADR-003-first.md': 'First decision',
    'decisions/ADR-012-second.md': 'Searchable second decision',
    'features/dashboard/dashboard.md': 'Dashboard overview',
    'shared/foreign/guide.md': 'Shared guide',
  };
  assert.deepEqual(filterDocumentGroups(groups, titles, 'searchable').flatMap((group) => group.items), ['decisions/ADR-012-second.md']);
  assert.deepEqual(filterDocumentGroups(groups, titles, 'shared/foreign').flatMap((group) => group.items), ['shared/foreign/guide.md']);

  const html = render(React.createElement(Documents, {
    tree, titles, active: 'shared/foreign/guide.md', onOpen() {},
  }));
  assert.match(html, /Search documents/);
  assert.match(html, /Decisions/);
  assert.match(html, /Shared/);
  assert.match(html, /Shared guide/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /Open full document/);
  assert.match(html, /Reading surface/);
  assert.match(html, /shared\/foreign\/guide\.md/);
  assert.doesNotMatch(html, /doc-toggle-label">Changes/);
  assert.match(html, /aria-expanded="false" aria-controls="spec-doc-list-decisions"/);

  const fallbackHtml = render(React.createElement(Documents, {
    tree: ['shared/foreign/guide.md'], titles: {}, active: 'shared/foreign/guide.md', onOpen() {},
  }));
  assert.match(fallbackHtml, /<h3 id="spec-reading-title">guide<\/h3>/);

  const specsSource = readSource('Specs.jsx');
  assert.match(specsSource, /fetch\('\/api\/specs\/tree'\)/);
  assert.match(specsSource, /\/api\/specs\/file\?path=\$\{encodeURIComponent\(path\)\}/);
  assert.match(specsSource, /text\.match\(\/\^\\s\*#\\s\+\(\.\+\)\$\/m\)/);
  assert.match(specsSource, /setReader\(\{ title: titles\[rel\] \|\| fallbackTitle\(rel\), path: rel \}\)/);
  assert.match(specsSource, /onOpenFile=\{openDoc\}/);
  assert.match(specsSource, /focusDocumentsAfterClose\.current = true/);
  assert.match(specsSource, /getElementById\('spec-tab-documents'\)\?\.focus\(\)/);
  assert.match(readSource('Documents.jsx'), /onClick=\{\(\) => onOpen\(path\)\}/);

  const { Markdown, MdLink, isSpecPath } = await vite.ssrLoadModule('/src/lib/markdown.jsx');
  assert.match(render(React.createElement(MdLink, {
    text: '[Read the ADR](decisions/ADR-003-first.md)', onOpenFile() {}, canOpen: isSpecPath,
  })), /class="md-link">Read the ADR<\/button>/);
  assert.match(render(React.createElement(Markdown, {
    text: '[Related record](decisions/ADR-003-first.md)', onOpenFile() {}, canOpen: isSpecPath,
  })), /data-specfile="decisions\/ADR-003-first\.md"/);

  const modalSource = readSource('SpecsMarkdownModal.jsx');
  assert.match(modalSource, /event\.key === 'Escape'/);
  assert.match(modalSource, /onClick=\{handleClose\}/);
  assert.match(modalSource, /event\.stopPropagation\(\)/);
  assert.match(modalSource, /const originalTriggerRef = useRef\(null\)/);
  assert.match(modalSource, /originalTriggerRef\.current = document\.activeElement/);
  assert.doesNotMatch(modalSource, /return \(\) => originalTriggerRef\.current\?\.focus/);
  assert.match(modalSource, /last\.focus\(\)/);
  assert.match(modalSource, /first\.focus\(\)/);
});

test('Specs modal local-link focus recovery keeps the original opener without remounting', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { SpecsMarkdownModal, scheduleFocusRestore } = await vite.ssrLoadModule('/src/components/SpecsMarkdownModal.jsx');
  const source = readSource('SpecsMarkdownModal.jsx');
  const specsSource = readSource('Specs.jsx');
  const markdownSource = fs.readFileSync(path.join(webRoot, 'src/lib/markdown.jsx'), 'utf8');
  const html = render(React.createElement(SpecsMarkdownModal, {
    title: 'First document', path: 'features/first.md',
    text: '[Related document](features/related.md)', onClose() {}, onOpenFile() {}, canOpen: () => true,
  }));

  assert.match(html, /role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /class="modal-close"/);
  assert.match(html, /data-specfile="features\/related\.md"/);
  const modalUsage = specsSource.match(/<SpecsMarkdownModal[\s\S]*?\/>/)?.[0] || '';
  assert.ok(modalUsage, 'the modal remains rendered at its stable reader position');
  assert.doesNotMatch(modalUsage, /\bkey=/);
  assert.match(markdownSource, /el && canOpen\(el\.dataset\.specfile\)/);
  assert.match(markdownSource, /onOpenFile\(el\.dataset\.specfile\)/);
  assert.match(source, /if \(!originalTriggerCapturedRef\.current\) \{\s*originalTriggerRef\.current = document\.activeElement/);
  assert.match(source, /if \(previous\.title !== title \|\| previous\.text !== text \|\| previous\.path !== path\)[\s\S]*?querySelector\('\.modal-close'\)[\s\S]*?\.focus\(\)/);
  assert.equal((source.match(/originalTriggerRef\.current = document\.activeElement/g) || []).length, 1);
  assert.match(source, /if \(event\.key === 'Escape'\)[\s\S]*?handleClose\(\)/);

  assert.equal((source.match(/onClick=\{handleClose\}/g) || []).length, 2, 'backdrop and close button share the close handler');
  assert.match(source, /const handleClose = \(\) => \{\s*const opener = originalTriggerRef\.current;\s*onClose\(\);\s*scheduleFocusRestore\(opener\);/);
  assert.match(source, /schedule = \(callback\) => requestAnimationFrame\(callback\)/);

  const pendingFrames = [];
  let focusCount = 0;
  const opener = { isConnected: true, focus() { focusCount += 1; } };
  scheduleFocusRestore(opener, (callback) => pendingFrames.push(callback));
  assert.equal(focusCount, 0, 'focus waits until the scheduled post-close frame');
  assert.equal(pendingFrames.length, 1);
  pendingFrames.shift()();
  assert.equal(focusCount, 1);

  opener.isConnected = false;
  scheduleFocusRestore(opener, (callback) => pendingFrames.push(callback));
  pendingFrames.shift()();
  assert.equal(focusCount, 1, 'a detached opener is not focused');
});

test('Specs layout keeps narrow content contained, scrolls dense tables locally, and respects reduced motion', () => {
  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  assert.match(css, /\.spec-documents\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1\.25fr\) minmax\(15rem, 0\.75fr\)/s);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.spec-documents\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.spec-tracker-scroll\s*\{[^}]*overflow-x:\s*auto[^}]*overscroll-behavior-inline:\s*contain/s);
  assert.match(css, /\.spec-tracker-scroll:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--guarana\)/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
