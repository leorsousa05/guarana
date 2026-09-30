import test from 'node:test';
import assert from 'node:assert/strict';
import { graphSignature, layoutGraph, readGraphPositions, saveGraphPositions } from './memoryGraphLayout.js';

test('graph signature ignores refreshed object identity and input order', () => {
  const nodes = [
    { id: 'project:b', scope: 'project' },
    { id: 'global:a', scope: 'global' },
  ];
  const edges = [{ from: 'project:b', to: 'global:a', rel: 'relates-to' }];
  const refreshedNodes = nodes.slice().reverse().map((node) => ({ ...node }));
  const refreshedEdges = edges.map((edge) => ({ ...edge }));

  assert.equal(graphSignature(nodes, edges), graphSignature(refreshedNodes, refreshedEdges));
  assert.notEqual(graphSignature(nodes, edges), graphSignature([...nodes, { id: 'project:c' }], edges));
});

test('layout preserves moved positions and only places newly added nodes', () => {
  const nodes = [
    { id: 'project:a', scope: 'project', intent: 'A' },
    { id: 'global:b', scope: 'global', intent: 'B' },
  ];
  const before = layoutGraph(nodes, []);
  const moved = new Map(before);
  moved.set('project:a', { x: 123, y: 234 });

  const after = layoutGraph([...nodes, { id: 'project:c', scope: 'project', intent: 'C' }], [
    { from: 'project:c', to: 'project:a', rel: 'relates-to' },
  ], moved);

  assert.deepEqual(after.get('project:a'), { x: 123, y: 234 });
  assert.deepEqual(after.get('global:b'), before.get('global:b'));
  assert.ok(after.get('project:c'));
});

test('initial layout separates project and global scope lanes deterministically', () => {
  const nodes = [
    { id: 'project:a', scope: 'project', intent: 'A' },
    { id: 'global:b', scope: 'global', intent: 'B' },
  ];
  const layout = layoutGraph(nodes, []);

  assert.ok(layout.get('project:a').x < layout.get('global:b').x);
  assert.deepEqual(layout, layoutGraph(nodes, []));
});

test('manual positions survive a graph component remount through session storage', () => {
  const nodes = [
    { id: 'project:a', scope: 'project' },
    { id: 'global:b', scope: 'global' },
  ];
  const storage = new Map();
  const session = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const manual = new Map([
    ['project:a', { x: 164, y: 318 }],
    ['global:b', { x: 612, y: 132 }],
  ]);

  saveGraphPositions(session, manual);
  const restored = readGraphPositions(session, nodes.map((node) => ({ ...node })));
  const remountedLayout = layoutGraph(nodes, [], restored);

  assert.deepEqual(remountedLayout, manual);
});
