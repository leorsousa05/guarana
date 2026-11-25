import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLineage } from '../../web/src/lib/lineage.js';

describe('buildLineage (supersedes diff)', () => {
  const nodes = [
    { id: 'a', type: 'decision', intent: 'oldest' },
    { id: 'b', type: 'decision', intent: 'middle' },
    { id: 'c', type: 'decision', intent: 'newest' },
    { id: 'x', type: 'bug', intent: 'unrelated' },
  ];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // b supersedes a (b replaced a); c supersedes b (c replaced b).
  const edges = [
    { from: 'b', to: 'a', rel: 'supersedes' },
    { from: 'c', to: 'b', rel: 'supersedes' },
    { from: 'x', to: 'c', rel: 'caused-by' }, // not a supersedes edge
  ];

  it('no selection yields empty lineage', () => {
    assert.deepEqual(buildLineage(null, edges, byId), { older: [], newer: [] });
  });

  it('older = nodes this node replaced, oldest-first', () => {
    // c replaced b, and b replaced a -> older = [a, b] (a is the oldest first)
    const { older } = buildLineage('c', edges, byId);
    assert.deepEqual(older.map((n) => n.id), ['a', 'b']);
  });

  it('newer = nodes that replaced this node, selected is oldest', () => {
    // b replaced by c -> newer = [c]
    const { newer } = buildLineage('b', edges, byId);
    assert.deepEqual(newer.map((n) => n.id), ['c']);
    // a replaced by b, and b replaced by c -> newer = [b, c]
    assert.deepEqual(buildLineage('a', edges, byId).newer.map((n) => n.id), ['b', 'c']);
  });

  it('ignores non-supersedes edges and unrelated nodes', () => {
    const { older, newer } = buildLineage('c', edges, byId);
    assert.ok(!older.some((n) => n.id === 'x'));
    assert.ok(!newer.some((n) => n.id === 'x'));
  });

  it('ignores cycles (does not loop forever)', () => {
    const cyclic = [
      { from: 'a', to: 'b', rel: 'supersedes' },
      { from: 'b', to: 'a', rel: 'supersedes' },
    ];
    const { older } = buildLineage('a', cyclic, byId);
    // only one step taken, then seen-guard stops the cycle
    assert.ok(older.length <= 1);
  });
});