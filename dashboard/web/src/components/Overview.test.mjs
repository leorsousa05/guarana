import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { after, before, test } from 'node:test';
import { handleMemoryBubbleKeyDown, layoutMemoryBubbles } from '../lib/memoryBubbleLayout.js';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let vite;
let OverviewContent;
let activeRootFromTelemetry;
let latestInjectionForRoot;
let latestAdvisorForRoot;
let overviewGraphModel;
let projectOverviewWorkers;
let defaultOverviewSelection;
let overviewSelectionEpoch;
let resolveOverviewSelection;
let selectOverviewMemory;

before(async () => {
  vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  ({ OverviewContent, activeRootFromTelemetry, latestInjectionForRoot, latestAdvisorForRoot, overviewGraphModel, projectOverviewWorkers,
    defaultOverviewSelection, overviewSelectionEpoch, resolveOverviewSelection, selectOverviewMemory } = await vite.ssrLoadModule('/src/components/Overview.jsx'));
});
after(async () => vite?.close());

const run = (sessionID, status, statusTs, parentSessionID = null) => ({ sessionID, status, statusTs, start: statusTs, parentSessionID });
const workerKey = '84000000-0000-4000-8000-000000000001';
const summary = { runs: [run('root-private-id-101', 'running', 20), run('old-root-secret-id', 'idle', 100)] };
const workflow = { state: 'coding', activeTask: 'Implement the workbench', goal: 'Keep the live operational context visible.' };
const injection = (sessionID, ts, memories) => ({ sessionID, ts, reason: 'session-start', memories });
const graphNode = (id, scope, intent, status = 'confirmed') => ({ id, scope, type: 'decision', intent, summary: `${intent} summary`, status });

function markup(overrides = {}) {
  return renderToStaticMarkup(React.createElement(OverviewContent, {
    summary, workflow, workflowLoading: false,
    workers: { data: { available: true, runningCount: 1, workers: [{ key: workerKey, agent: 'worker-code', status: 'busy' }] } },
    advisorHistory: { data: { history: [{ parentSessionID: 'root-private-id-101', status: 'running' }] } },
    injections: { data: { injections: [injection('root-private-id-101', 22, [graphNode('shared', 'project', 'Injected decision')])] } },
    graph: { data: { nodes: [graphNode('shared', 'project', 'Injected decision'), graphNode('neighbor', 'project', 'Direct neighbor')], edges: [{ scope: 'project', from: 'shared', to: 'neighbor', rel: 'fixes' }] } },
    ...overrides,
  }));
}

test('active root selection requires an observed busy/running root and ignores idle historical roots', () => {
  const data = { runs: [
    run('idle-newest', 'idle', 99),
    run('worker', 'running', 100, 'parent'),
    run('active-root', 'busy', 20),
    run('active-root-newer', 'running', 30),
  ] };
  assert.equal(activeRootFromTelemetry(data).sessionID, 'active-root-newer');
  assert.equal(activeRootFromTelemetry({ runs: [run('old', 'idle', 500)] }), null);
  assert.equal(activeRootFromTelemetry(null), null);
});

test('latest injection is selected only from the active root and by newest observed timestamp', () => {
  const root = run('active-root-secret', 'busy', 10);
  const rows = [injection('other-session-private', 100, []), injection(root.sessionID, 10, [{ id: 'old' }]), injection(root.sessionID, 12, [{ id: 'new' }])];
  assert.deepEqual(latestInjectionForRoot(rows, root).memories, [{ id: 'new' }]);
  assert.equal(latestInjectionForRoot(rows, null), null);
  assert.equal(latestInjectionForRoot(rows, run('missing', 'running', 1)), null);
});

test('worker projection consumption drops unsafe fields and requires an allowlisted observed row', () => {
  const safe = { key: workerKey, agent: 'worker-code', status: 'running', title: 'PRIVATE TITLE', sessionID: 'real-session-id', parentID: 'real-parent-id', prompt: 'private prompt', output: 'private output', token: 'secret sentinel' };
  assert.deepEqual(projectOverviewWorkers({ data: { available: true, workers: [safe, { ...safe, status: 'idle' }, { ...safe, agent: 'token-secret' }, { ...safe, key: 'not-an-opaque-key' }] } }), [
    { key: workerKey, agent: 'worker-code', status: 'running' },
  ]);
  assert.deepEqual(projectOverviewWorkers({ data: { available: false, workers: [safe] } }), []);
  const html = markup({ workers: { data: { available: true, runningCount: 1, workers: [safe] } } });
  assert.match(html, /worker-code/);
  assert.match(html, /running/);
  assert.match(html, /ref 84000000…0001/);
  assert.doesNotMatch(html, /84000000-0000-4000-8000-000000000001/);
  for (const privateValue of ['PRIVATE TITLE', 'real-session-id', 'real-parent-id', 'private prompt', 'private output', 'secret sentinel']) {
    assert.doesNotMatch(html, new RegExp(privateValue));
  }
  assert.doesNotMatch(html, /data-session-id|data-parent-id|prompt|reasoning|root-private-id-101|old-root-secret-id/);
});

test('Overview renders observed Advisor states, never configuration-derived running', () => {
  assert.deepEqual(latestAdvisorForRoot([{ parentSessionID: 'expected-root', status: 'running' }, { parentSessionID: 'another-root', status: 'completed' }], { sessionID: 'expected-root' }), { parentSessionID: 'expected-root', status: 'running' });
  assert.equal(latestAdvisorForRoot([{ parentSessionID: 'another-root' }], { sessionID: 'expected-root' }), null);
  const active = markup();
  assert.match(active, /Running · observed in the active root\./);
  assert.doesNotMatch(active, /configured|enabled/);
  const nonRunning = markup({ advisorHistory: { data: { history: [{ parentSessionID: 'root-private-id-101', status: 'completed' }] } } });
  assert.match(nonRunning, /Most recently observed · completed\./);
  const notCalled = markup({ advisorHistory: { data: { history: [] } } });
  assert.match(notCalled, /Advisor not observed in the latest root session\./);
  const loading = markup({ advisorHistory: {} });
  assert.match(loading, /Loading Advisor runtime…/);
  const rootLoading = markup({ summary: null, summaryLoading: true, advisorHistory: { data: { history: [] } } });
  assert.match(rootLoading, /Loading telemetry root for Advisor runtime…/);
  const unavailable = markup({ advisorHistory: { error: 'raw private error' } });
  assert.match(unavailable, /Advisor runtime unavailable\./);
  assert.doesNotMatch(unavailable, /raw private error/);
});

test('Overview separates no-active-root, no matching injection, loading, and injection errors', () => {
  const noRoot = markup({ summary: { runs: [run('idle-root-private', 'idle', 3)] } });
  assert.match(noRoot, /No active root session observed\./);
  assert.doesNotMatch(noRoot, /idle-root-private/);
  const noMatch = markup({ injections: { data: { injections: [injection('another-private-session', 100, [graphNode('neighbor', 'project', 'Wrong injection')])] } } });
  assert.match(noMatch, /No injection observed for the active root\./);
  assert.doesNotMatch(noMatch, /Wrong injection/);
  assert.match(markup({ injections: {} }), /Loading active-root injection…/);
  const failed = markup({ injections: { error: 'private raw error' } });
  assert.match(failed, /Memory injection history unavailable\./);
  assert.doesNotMatch(failed, /private raw error/);
});

test('Overview state and workflow strip render truthful loading, unavailable, and empty states', () => {
  const loading = markup({ summary: null, workflow: null, workflowLoading: true, workers: {}, advisorHistory: {}, injections: {}, graph: {} });
  assert.match(loading, /Loading workflow context…/);
  assert.match(loading, /Loading active workers…/);
  assert.match(loading, /Loading memory graph…/);
  assert.match(loading, /Loading telemetry root…/);
  const unavailable = markup({ summaryError: 'raw telemetry error', workflowError: 'raw workflow error', workers: { error: 'raw worker error' }, graph: { error: 'raw graph error' } });
  assert.match(unavailable, /Workflow context unavailable\./);
  assert.match(unavailable, /Active root unavailable because telemetry could not be loaded\./);
  assert.match(unavailable, /Active worker status unavailable\./);
  assert.match(unavailable, /Memory graph unavailable\./);
  assert.doesNotMatch(unavailable, /raw (telemetry|workflow|worker|graph) error/);
  const empty = markup({ workers: { data: { available: true, runningCount: 0, workers: [] } }, graph: { data: { nodes: [], edges: [] } } });
  assert.match(empty, /No active workers observed\./);
  assert.match(empty, /No confirmed memories available\./);
});

test('scope qualification prevents ID collisions and injected highlighting follows scope-qualified references', () => {
  const result = overviewGraphModel({
    nodes: [graphNode('same', 'project', 'Project'), graphNode('same', 'global', 'Global'), graphNode('draft', 'project', 'Draft', 'draft')],
    edges: [{ scope: 'project', from: 'same', to: 'same', rel: 'fixes' }, { scope: 'global', from: 'same', to: 'same', rel: 'depends-on' }],
  }, [{ id: 'same', scope: 'global' }]);
  assert.deepEqual(result.nodes.map((node) => node.id), ['project:same', 'global:same']);
  assert.deepEqual(result.edges.map(({ from, to }) => [from, to]), [['project:same', 'project:same'], ['global:same', 'global:same']]);
  assert.deepEqual([...result.injected], ['global:same']);
  const html = markup();
  assert.match(html, /ov-map-node--injected/);
  assert.match(html, /injected into active root/);
  assert.match(html, /Read-only memory graph; scroll within this region/);
});

test('graph marks every memory in the active root latest injection and ignores other-root history', () => {
  const targetProject = graphNode('target-project', 'project', 'Current project memory');
  const targetGlobal = graphNode('target-global', 'global', 'Current global memory');
  const html = markup({
    injections: { data: { injections: [
      injection('root-private-id-101', 21, [graphNode('old', 'project', 'Older root injection')]),
      injection('other-session-private', 99, [graphNode('other', 'project', 'Another session injection')]),
      injection('root-private-id-101', 22, [targetProject, targetGlobal]),
    ] } },
    graph: { data: { nodes: [graphNode('old', 'project', 'Older root injection'), graphNode('other', 'project', 'Another session injection'), targetProject, targetGlobal], edges: [] } },
  });
  assert.equal((html.match(/ov-map-node--injected/g) || []).length, 2);
  assert.match(html, /Current project memory/);
  assert.match(html, /Current global memory/);
  assert.doesNotMatch(html, /ov-map-node--injected[^>]*Another session injection|ov-map-node--injected[^>]*Older root injection/);
  assert.match(html, /2 memories observed/);
  const failed = markup({ injections: { error: 'unavailable' } });
  assert.doesNotMatch(failed, /ov-map-node--injected/);
});

test('active-root injection lists every readable memory and marks graph-missing references unavailable', () => {
  const visible = graphNode('visible', 'global', 'Readable injected preference');
  const missing = { ...graphNode('missing', 'project', ''), available: false };
  const html = markup({
    injections: { data: { injections: [injection('root-private-id-101', 22, [visible, missing])] } },
    graph: { data: { nodes: [visible], edges: [] } },
  });

  assert.match(html, /aria-label="Memories in the active-root injection"/);
  assert.match(html, /global/);
  assert.match(html, /decision/);
  assert.match(html, /Readable injected preference/);
  assert.match(html, /project/);
  assert.match(html, /Intent unavailable/);
  assert.match(html, /Not available in graph\./);
  assert.match(html, /aria-pressed="true"/);
  for (const sessionId of ['root-private-id-101', 'old-root-secret-id']) {
    assert.doesNotMatch(html, new RegExp(sessionId));
    assert.doesNotMatch(html, new RegExp(`(?:data-[\\w-]+|aria-label|title)="[^"]*${sessionId}`));
  }
  const empty = markup({ injections: { data: { injections: [injection('root-private-id-101', 23, [])] } } });
  assert.match(empty, /No memories recorded in this injection\./);
  const unavailableGraph = markup({
    injections: { data: { injections: [injection('root-private-id-101', 23, [visible])] } },
    graph: { error: 'raw graph error' },
  });
  assert.match(unavailableGraph, /Graph unavailable\./);
  assert.match(unavailableGraph, /disabled="" aria-label=/);
  assert.doesNotMatch(unavailableGraph, /raw graph error/);
});

test('selection defaults to first available injected qualified node and injected choices stay highlighted', () => {
  const injectedGlobal = graphNode('shared', 'global', 'Injected global preference');
  const injectedProject = graphNode('target', 'project', 'Injected project decision');
  const graph = {
    nodes: [graphNode('other', 'project', 'Other memory'), injectedProject, injectedGlobal, graphNode('other-global', 'global', 'Global neighbor')],
    edges: [
      { scope: 'project', from: 'target', to: 'other', rel: 'fixes' },
      { scope: 'global', from: 'shared', to: 'other-global', rel: 'relates-to' },
    ],
  };
  const records = [injectedGlobal, injectedProject];
  const model = overviewGraphModel(graph, records);
  const firstRoot = run('active-root-private-a', 'running', 20);
  const firstInjection = injection(firstRoot.sessionID, 22, records);
  const firstEpoch = overviewSelectionEpoch(firstRoot, firstInjection);
  const html = markup({
    summary: { runs: [firstRoot] },
    injections: { data: { injections: [firstInjection] } },
    graph: { data: graph },
  });

  assert.equal(defaultOverviewSelection(model), 'global:shared', 'first available injected reference wins over graph node order');
  assert.equal(resolveOverviewSelection(model, null, firstEpoch), 'global:shared');
  assert.match(html, /data-memory-id="global:shared" data-scope="global"[^>]*aria-pressed="true"/);
  assert.match(html, /Selected memory details/);
  assert.match(html, /Injected global preference summary/);
  assert.match(html, /Outgoing · relates-to · global/);

  const fromList = selectOverviewMemory(firstEpoch, 'project:target');
  assert.equal(resolveOverviewSelection(model, fromList, firstEpoch), 'project:target', 'selecting an injected list entry selects its qualified graph node');
  const fromGraph = selectOverviewMemory(firstEpoch, 'project:other');
  assert.equal(resolveOverviewSelection(model, fromGraph, firstEpoch), 'project:other', 'a later graph-node selection replaces the selected record');
  assert.deepEqual([...model.injected], ['global:shared', 'project:target'], 'selection does not alter the complete injected highlight set');

  const nextRoot = run('active-root-private-b', 'running', 30);
  const nextInjection = injection(nextRoot.sessionID, 32, [graphNode('next', 'project', 'New injected memory')]);
  const nextModel = overviewGraphModel({ nodes: [graphNode('other', 'project', 'Other memory'), ...nextInjection.memories], edges: [] }, nextInjection.memories);
  const nextEpoch = overviewSelectionEpoch(nextRoot, nextInjection);
  assert.notEqual(nextEpoch, firstEpoch);
  assert.equal(resolveOverviewSelection(nextModel, fromGraph, nextEpoch), 'project:next', 'a changed active-root injection resets selection to its injected memory');
  assert.doesNotMatch(html, /active-root-private-a|active-root-private-b/);
});

test('read-only graph selection reports real direct neighbors and keeps layout centers/camera stable', () => {
  const html = markup();
  assert.match(html, /Selected memory details/);
  assert.match(html, /Direct relationships/);
  assert.match(html, /Outgoing · fixes · project/);
  assert.match(html, /Direct neighbor/);
  assert.doesNotMatch(html, /Manage project links|Text-match suggestions|Review link|Remove link|Confirm and save|Confirm removal/);

  const nodes = [
    { id: 'project:a', scope: 'project', memoryId: 'a' },
    { id: 'project:b', scope: 'project', memoryId: 'b' },
    { id: 'global:c', scope: 'global', memoryId: 'c' },
  ];
  const edges = [{ from: 'project:a', to: 'project:b', scope: 'project' }];
  const a = layoutMemoryBubbles(nodes, edges, 'project:a');
  const b = layoutMemoryBubbles(nodes, edges, 'global:c');
  const centers = (layout) => new Map(layout.nodes.map(({ id, x, y }) => [id, [x, y]]));
  for (const node of nodes) assert.deepEqual(centers(a).get(node.id), centers(b).get(node.id));
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);

  const selected = [];
  const focused = [];
  handleMemoryBubbleKeyDown({ key: 'ArrowRight', preventDefault() {} }, a.nodes, 'project:a', (id) => selected.push(id), (id) => focused.push(id));
  assert.deepEqual(focused, ['project:b']);
  handleMemoryBubbleKeyDown({ key: 'Enter', preventDefault() {} }, a.nodes, 'project:a', (id) => selected.push(id), () => {});
  assert.deepEqual(selected, ['project:a']);
});

test('initial graph viewport centers once after graph data, independently of selection', () => {
  const source = fs.readFileSync(path.join(webRoot, 'src/components/Overview.jsx'), 'utf8');
  const graphStart = source.indexOf('function ReadOnlyMemoryGraph');
  const effectStart = source.indexOf('useEffect(() => {', graphStart);
  const effectEnd = source.indexOf('\n\n  return (', effectStart);
  const effect = source.slice(effectStart, effectEnd);

  assert.match(source, /const viewportRef = useRef\(null\);/);
  assert.match(source, /const canvasRef = useRef\(null\);/);
  assert.match(source, /const initialCenterApplied = useRef\(false\);/);
  assert.match(effect, /if \(initialCenterApplied\.current \|\| graphError \|\| !graphState\?\.data \|\| !layout\.nodes\.length\) return;/);
  assert.match(effect, /viewport\.scrollLeft = Math\.max\(0, \(canvas\.clientWidth - viewport\.clientWidth\) \/ 2\);/);
  assert.match(effect, /viewport\.scrollTop = Math\.max\(0, \(canvas\.clientHeight - viewport\.clientHeight\) \/ 2\);/);
  assert.match(effect, /\}, \[graphError, graphState\?\.data, layout\.nodes\.length, layout\.width, layout\.height\]\);/);
  assert.doesNotMatch(effect, /selectedId|onSelect/);
});

test('Overview removes former summaries and roadmap while retaining compact workflow context', () => {
  const html = markup({ workflow: { state: 'coding', activeTask: 'Keep the task', goal: 'Keep the goal' } });
  assert.match(html, /aria-label="Current workflow context"/);
  assert.match(html, /phase/);
  assert.match(html, /Keep the task/);
  assert.match(html, /Keep the goal/);
  for (const retired of ['Runs', 'Decisions', 'Roadmap', 'supernodes', 'memory summary']) assert.doesNotMatch(html, new RegExp(retired));
});

test('Overview CSS bounds the page, worker overflow, and graph navigation at desktop and mobile sizes', () => {
  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  assert.match(css, /\.ov\s*\{[^}]*height:\s*calc\(100dvh\s*-\s*210px\)[^}]*overflow:\s*hidden/);
  assert.match(css, /@media \(max-width:\s*840px\)[\s\S]*?\.ov\s*\{[^}]*height:\s*calc\(100dvh\s*-\s*280px\)/);
  assert.match(css, /\.ov-worker-list\s*\{[^}]*max-height:\s*100%[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.ov-injection-list\s*\{[^}]*max-height:\s*100%[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.ov-injection\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.ov-map-viewport\s*\{[^}]*overflow:\s*auto[^}]*overscroll-behavior:\s*contain/);
  assert.match(css, /\.ov-map-viewport:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.ov \*/);
});
