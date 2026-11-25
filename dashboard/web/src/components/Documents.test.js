import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroups, filterDocumentGroups } from './documentsTaxonomy.js';

const placeholderArchiveTree = [
  'README.md',
  'architecture.md',
  'archive/README.md',
  'changes/README.md',
  'changes/2026-08-21-build.md',
  'changes/2026-09-28-specs-validator.md',
  'changes/2026-10-09-dashboard-search.md',
  'changes/2026-10-11-dashboard-redesign.md',
  'decisions/ADR-002-project-root.md',
  'decisions/ADR-010-memory-vault.md',
  'decisions/ADR-003-verification-split.md',
  'decisions/notes.md',
  'features/overview.md',
  'features/dashboard/specs-documents-taxonomy.md',
  'features/guarana/build.md',
  'features/guarana/audits/overview.md',
  'features/guarana/proofs/check.md',
  'shared/foreign/guide.md',
  'state/project-state.md',
];

const flatten = (groups) => groups.flatMap((group) => [
  ...group.items,
  ...flatten(group.children),
]);
const byLabel = (groups, label) => groups.find((group) => group.label === label);

test('builds a compact hierarchy with complete unique coverage, local labels, counts, and ordering', () => {
  const groups = buildGroups(placeholderArchiveTree);
  const paths = flatten(groups);
  const expected = placeholderArchiveTree.filter((path) => (
    !path.startsWith('state/') && path !== 'archive/README.md'
  ));

  assert.deepEqual(groups.map((group) => group.label), ['Decisions', 'Changes', 'Features', 'Foundations', 'Other']);
  assert.deepEqual([...paths].sort(), [...expected].sort());
  assert.equal(paths.length, expected.length, 'every visible document appears exactly once');
  assert.equal(new Set(paths).size, paths.length, 'no document is assigned more than once');
  assert.ok(groups.every((group) => group.count > 0), 'empty collections are omitted');

  const changes = byLabel(groups, 'Changes');
  assert.deepEqual(changes.children.map((group) => group.label), [
    'October 2026', 'September 2026', 'August 2026', 'General',
  ]);
  assert.deepEqual(changes.children[0].items, [
    'changes/2026-10-11-dashboard-redesign.md',
    'changes/2026-10-09-dashboard-search.md',
  ]);
  assert.deepEqual(changes.children.at(-1).items, ['changes/README.md']);

  const decisions = byLabel(groups, 'Decisions');
  assert.deepEqual(decisions.items, [
    'decisions/ADR-010-memory-vault.md',
    'decisions/ADR-003-verification-split.md',
    'decisions/ADR-002-project-root.md',
    'decisions/notes.md',
  ]);

  const features = byLabel(groups, 'Features');
  assert.deepEqual(features.children.map((group) => group.label), ['Dashboard', 'General / Overview', 'Guarana']);
  const guarana = byLabel(features.children, 'Guarana');
  assert.deepEqual(guarana.children.map((group) => group.label), ['Audits', 'Proofs']);
  assert.deepEqual(guarana.items, ['features/guarana/build.md']);
  assert.equal(features.count, 5);

  assert.deepEqual(byLabel(groups, 'Foundations').items, ['README.md', 'architecture.md']);
  assert.deepEqual(byLabel(groups, 'Other').children[0].children.map((group) => group.label), ['Foreign']);
  assert.deepEqual(byLabel(groups, 'Other').children[0].children[0].items, ['shared/foreign/guide.md']);
  assert.equal(groups.some((group) => group.label === 'Archive'), false);
  assert.equal(paths.includes('archive/README.md'), false, 'the empty archive index is omitted entirely');

  const countEverywhere = (nodes) => nodes.forEach((node) => {
    assert.equal(node.count, node.items.length + node.children.reduce((sum, child) => sum + child.count, 0));
    countEverywhere(node.children);
  });
  countEverywhere(groups);
});

test('shows a top-level Archive only when real archived artifacts exist', () => {
  const tree = [...placeholderArchiveTree, 'archive/retired-spec.md'];
  const groups = buildGroups(tree);
  const paths = flatten(groups);
  const archive = byLabel(groups, 'Archive');

  assert.ok(archive);
  assert.deepEqual(archive.items, ['archive/README.md', 'archive/retired-spec.md']);
  assert.deepEqual([...paths].sort(), tree.filter((path) => !path.startsWith('state/')).sort());
  assert.equal(paths.length, tree.filter((path) => !path.startsWith('state/')).length);
  assert.equal(groups.some((group) => group.label === 'Foundations / Archive index'), false);
});

test('search matches titles and paths, preserves hierarchy, and counts unique matching documents', () => {
  const groups = buildGroups([...placeholderArchiveTree, 'changes/2026-10-09-dashboard-search.md']);
  const titles = {
    'features/guarana/audits/overview.md': 'Deployment Audit Guide',
  };

  const titleMatches = filterDocumentGroups(groups, titles, 'deployment audit');
  assert.deepEqual(flatten(titleMatches), ['features/guarana/audits/overview.md']);
  assert.equal(titleMatches[0].label, 'Features');
  assert.equal(titleMatches[0].count, 1);
  assert.equal(titleMatches[0].children[0].label, 'Guarana');
  assert.equal(titleMatches[0].children[0].count, 1);
  assert.deepEqual(flatten(filterDocumentGroups(groups, titles, 'proofs/check')), ['features/guarana/proofs/check.md']);
  assert.deepEqual(flatten(filterDocumentGroups(groups, titles, 'shared/foreign')), ['shared/foreign/guide.md']);
  const pathMatches = filterDocumentGroups(groups, titles, 'dashboard');
  assert.equal(pathMatches.reduce((count, group) => count + group.count, 0), 3);
  assert.equal(flatten(pathMatches).length, 3, 'duplicate tree paths do not inflate matching counts');
  assert.deepEqual(filterDocumentGroups(groups, titles, 'nothing matches'), []);
});
