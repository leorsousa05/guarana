import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMemoryBubbleView,
  fitMemoryCamera,
  focusMemoryCamera,
  handleMemoryBubbleKeyDown,
  layoutMemoryBubbles,
  panMemoryCamera,
  qualifyMemoryGraph,
  zoomMemoryCamera,
} from './memoryBubbleLayout.js';

function graphFixture() {
  const nodes = [
    { id: 'shared', scope: 'project', type: 'decision', intent: 'Project focus' },
    { id: 'out', scope: 'project', type: 'solution', intent: 'Outgoing neighbor' },
    { id: 'in', scope: 'project', type: 'bug', intent: 'Incoming neighbor' },
    { id: 'other', scope: 'project', type: 'refactor', intent: 'Unrelated project' },
    { id: 'shared', scope: 'global', type: 'preference', intent: 'Global focus' },
    { id: 'global-neighbor', scope: 'global', type: 'preference', intent: 'Global neighbor' },
  ];
  const edges = [
    { scope: 'project', from: 'shared', to: 'out', rel: 'fixes' },
    { scope: 'project', from: 'in', to: 'shared', rel: 'caused-by' },
    { scope: 'project', from: 'out', to: 'other', rel: 'relates-to' },
    { scope: 'global', from: 'shared', to: 'global-neighbor', rel: 'depends-on' },
  ];
  return qualifyMemoryGraph(nodes, edges);
}

test('Network layout deterministically contains every visible scoped node and only actual matching edges', () => {
  const { nodes, edges } = graphFixture();
  const visibleNodes = nodes.concat(Array.from({ length: 78 }, (_, index) => {
    const scope = index < 72 ? 'project' : 'global';
    return {
      id: `${scope}:extra-${index}`,
      memoryId: `extra-${index}`,
      scope,
      type: 'atom',
      intent: `Extra ${index}`,
    };
  }));
  const actualEdges = [...edges, { scope: 'project', from: 'project:extra-0', to: 'project:out', rel: 'summarizes' }];
  const filteredEdges = actualEdges.filter((edge) => visibleNodes.some((node) => node.id === edge.from) && visibleNodes.some((node) => node.id === edge.to));
  const first = layoutMemoryBubbles(visibleNodes, filteredEdges, 'project:shared', 'network');
  const second = layoutMemoryBubbles(visibleNodes, filteredEdges, 'project:shared', 'network');
  assert.deepEqual(first, second, 'the same graph always receives the same coordinates');
  assert.deepEqual(first.nodes.map((node) => node.id).sort(), visibleNodes.map((node) => node.id).sort());
  assert.deepEqual(first.edges, filteredEdges);
  assert.equal(first.nodes.find((node) => node.id === 'project:shared').focus, true);
  assert.equal(first.nodes.find((node) => node.id === 'project:out').neighbor, true);
  assert.ok(first.nodes.find((node) => node.id === 'project:extra-0').x !== first.nodes.find((node) => node.id === 'global:extra-77').x);
  assert.ok(first.width >= 520 && first.height >= 520);
  assert.ok(first.nodes.every((node) => node.x - node.diameter / 2 >= 0 && node.x + node.diameter / 2 <= first.width));
  for (let left = 0; left < first.nodes.length; left += 1) {
    for (let right = left + 1; right < first.nodes.length; right += 1) {
      const a = first.nodes[left];
      const b = first.nodes[right];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= (a.diameter + b.diameter) / 2, `${a.id} and ${b.id} bubbles do not overlap`);
    }
  }
});

test('Neighborhood includes selected node and direct incoming/outgoing neighbors but excludes unrelated nodes and edges', () => {
  const { nodes, edges } = graphFixture();
  const view = buildMemoryBubbleView(nodes, edges, 'project:shared', 'neighborhood');
  assert.deepEqual(view.nodes.map((node) => node.id).sort(), ['project:in', 'project:out', 'project:shared']);
  assert.deepEqual(view.edges.map(({ from, to, rel }) => [from, to, rel]), [
    ['project:shared', 'project:out', 'fixes'],
    ['project:in', 'project:shared', 'caused-by'],
  ]);
  const layout = layoutMemoryBubbles(nodes, edges, 'project:shared', 'neighborhood');
  assert.equal(layout.nodes.length, 3);
  assert.ok(layout.nodes.find((node) => node.id === 'project:shared').focus);
});

test('Selection and view mode preserve shared bubble centers and canvas dimensions', () => {
  const { nodes, edges } = graphFixture();
  const networkShared = layoutMemoryBubbles(nodes, edges, 'project:shared', 'network');
  const networkGlobal = layoutMemoryBubbles(nodes, edges, 'global:shared', 'network');
  const neighborhoodShared = layoutMemoryBubbles(nodes, edges, 'project:shared', 'neighborhood');
  const neighborhoodOut = layoutMemoryBubbles(nodes, edges, 'project:out', 'neighborhood');
  const centers = (layout) => new Map(layout.nodes.map(({ id, x, y }) => [id, { x, y }]));
  const assertSameCenters = (first, second, ids) => {
    const firstCenters = centers(first);
    const secondCenters = centers(second);
    for (const id of ids) assert.deepEqual(secondCenters.get(id), firstCenters.get(id), `${id} keeps its absolute center`);
  };

  for (const layout of [networkGlobal, neighborhoodShared, neighborhoodOut]) {
    assert.equal(layout.width, networkShared.width);
    assert.equal(layout.height, networkShared.height);
  }
  assertSameCenters(networkShared, networkGlobal, nodes.map((node) => node.id));
  assertSameCenters(neighborhoodShared, neighborhoodOut, ['project:shared', 'project:out']);
  assert.deepEqual(neighborhoodOut.nodes.map((node) => node.id).sort(), ['project:other', 'project:out', 'project:shared']);
  assert.ok(neighborhoodOut.nodes.find((node) => node.id === 'project:out').focus);
  assert.notDeepEqual(
    { x: neighborhoodOut.nodes.find((node) => node.id === 'project:out').x, y: neighborhoodOut.nodes.find((node) => node.id === 'project:out').y },
    { x: neighborhoodOut.width / 2, y: neighborhoodOut.height / 2 },
    'selection emphasis does not recenter the selected bubble',
  );
});

test('raw IDs shared by project and global remain scope-qualified before lookup and layout', () => {
  const { nodes, edges } = graphFixture();
  assert.equal(nodes.filter((node) => node.memoryId === 'shared').length, 2);
  assert.deepEqual(nodes.filter((node) => node.memoryId === 'shared').map((node) => node.id), ['project:shared', 'global:shared']);
  assert.equal(edges.find((edge) => edge.scope === 'project').from, 'project:shared');
  assert.equal(edges.find((edge) => edge.scope === 'global').from, 'global:shared');
  const network = layoutMemoryBubbles(nodes, edges, 'global:shared', 'network');
  assert.equal(network.nodes.find((node) => node.id === 'global:shared').focus, true);
  assert.equal(network.nodes.find((node) => node.id === 'project:shared').focus, false);
});

test('bubble keyboard arrows move roving focus and Enter/Space select without dropping focus', () => {
  const nodes = [{ id: 'project:a' }, { id: 'global:b' }, { id: 'project:c' }];
  const focused = [];
  const selected = [];
  const run = (key, currentId) => {
    let prevented = false;
    handleMemoryBubbleKeyDown({ key, preventDefault: () => { prevented = true; } }, nodes, currentId, (id) => selected.push(id), (id) => focused.push(id));
    return prevented;
  };
  assert.equal(run('ArrowRight', 'project:a'), true);
  assert.equal(focused.at(-1), 'global:b');
  assert.equal(run('ArrowUp', 'project:a'), true);
  assert.equal(focused.at(-1), 'project:c');
  assert.equal(run('Enter', 'global:b'), true);
  assert.equal(run(' ', 'project:c'), true);
  assert.deepEqual(selected, ['global:b', 'project:c']);
  assert.deepEqual(focused, ['global:b', 'project:c'], 'selection keys do not move focus away from the active bubble');
});

test('Fit map bounds every node and zoom keeps its chosen map point fixed', () => {
  const layout = { width: 1200, height: 800 };
  const viewport = { width: 700, height: 500 };
  const fitted = fitMemoryCamera(layout, viewport);
  const left = fitted.x;
  const top = fitted.y;
  const right = fitted.x + layout.width * fitted.scale;
  const bottom = fitted.y + layout.height * fitted.scale;
  assert.ok(left >= 27 && top >= 27);
  assert.ok(right <= viewport.width - 27 && bottom <= viewport.height - 27);

  const anchor = { x: 350, y: 250 };
  const before = { x: (anchor.x - fitted.x) / fitted.scale, y: (anchor.y - fitted.y) / fitted.scale };
  const zoomed = zoomMemoryCamera(fitted, 1.5, layout, viewport, anchor);
  const after = { x: (anchor.x - zoomed.x) / zoomed.scale, y: (anchor.y - zoomed.y) / zoomed.scale };
  assert.ok(Math.abs(before.x - after.x) < 0.001);
  assert.ok(Math.abs(before.y - after.y) < 0.001);

  const compactFit = fitMemoryCamera({ width: 20000, height: 10000 }, { width: 400, height: 300 });
  assert.ok(compactFit.scale < 0.08, 'Fit map can scale large graphs down far enough to show all nodes');
  assert.ok(compactFit.x >= 27 && compactFit.y >= 27);
  assert.ok(compactFit.x + 20000 * compactFit.scale <= 373);
  assert.ok(compactFit.y + 10000 * compactFit.scale <= 273);
});

test('Focus selected recenters without changing zoom and pan remains clamped to reachable map bounds', () => {
  const layout = { width: 800, height: 600 };
  const viewport = { width: 640, height: 440 };
  const selected = { x: 400, y: 300 };
  const camera = { scale: 0.9, x: 12, y: 30 };
  const focused = focusMemoryCamera(camera, selected, layout, viewport);
  assert.equal(focused.scale, camera.scale);
  assert.equal(focused.x + selected.x * focused.scale, viewport.width / 2);
  assert.equal(focused.y + selected.y * focused.scale, viewport.height / 2);

  const panned = panMemoryCamera(focused, 5000, -5000, layout, viewport);
  assert.ok(panned.x <= 28 && panned.y <= 28);
  assert.ok(panned.x >= viewport.width - layout.width * panned.scale + 28);
  assert.ok(panned.y >= viewport.height - layout.height * panned.scale + 28);

  const initialViewport = { width: 350, height: 550 };
  const initialNode = { x: 260, y: 260 };
  const initial = focusMemoryCamera({ scale: 1, x: 0, y: 0 }, initialNode, { width: 520, height: 520 }, initialViewport);
  assert.equal(initial.scale, 1);
  assert.equal(initial.x + initialNode.x, initialViewport.width / 2);
  assert.equal(initial.y + initialNode.y, initialViewport.height / 2);
});
