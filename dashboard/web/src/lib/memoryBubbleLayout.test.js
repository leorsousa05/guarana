import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMemoryBubbleView, handleMemoryBubbleKeyDown, layoutMemoryBubbles, qualifyMemoryGraph } from './memoryBubbleLayout.js';

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
