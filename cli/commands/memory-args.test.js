'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseMemoryArgs } = require('./memory-args.js');

describe('parseMemoryArgs', () => {
  const cases = [
    ['no arguments', [], { command: 'help' }],
    ['--help', ['--help'], { command: 'help' }],
    ['-h', ['-h'], { command: 'help' }],
    ['init', ['init'], { command: 'init' }],
    ['status ignores extra arguments', ['status', 'extra'], { command: 'status' }],
    ['search term and all filters', [
      'search', 'coffee', '--type', 'decision', '--project', 'HASH',
      '--since', '1700000000000', '--until', '2024-01-02', '--limit', '5',
    ], {
      command: 'search',
      term: 'coffee',
      options: {
        query: 'coffee',
        type: 'decision',
        project: 'HASH',
        since: 1700000000000,
        until: Date.parse('2024-01-02'),
        limit: 5,
      },
    }],
    ['search without a term', ['search', '--type', 'bug', '--project', 'HASH'], {
      command: 'search',
      term: undefined,
      options: { query: undefined, type: 'bug', project: 'HASH' },
    }],
    ['search treats unknown flags and later positional values leniently', [
      'search', '--ignored', 'value', '--limit', '2', 'later', '--limit', '3', '--project', 'HASH',
    ], {
      command: 'search',
      term: undefined,
      options: { query: undefined, type: undefined, project: 'HASH', limit: 3 },
    }],
    ['search duplicate flags use the last value', [
      'search', 'term', '--type', 'bug', '--type', 'decision', '--limit', '2', '--limit', '4',
    ], {
      command: 'search',
      term: 'term',
      options: { query: 'term', type: 'decision', project: undefined, limit: 4 },
    }],
    ['search preserves a flag-looking option value', ['search', '--type', '--project', 'HASH'], {
      command: 'search',
      term: undefined,
      options: { query: undefined, type: '--project', project: undefined },
    }],
    ['export file', ['export', 'vault.json', 'ignored'], { command: 'export', file: 'vault.json' }],
    ['import file', ['import', 'vault.json'], { command: 'import', file: 'vault.json' }],
    ['compact default', ['compact'], { command: 'compact', options: {} }],
    ['compact threshold and duplicate flag', ['compact', '--threshold', '0', '--threshold', '2'], {
      command: 'compact', options: { threshold: 2 },
    }],
    ['compact ignores unknown flags', ['compact', '--other', 'value', '--threshold', '7'], {
      command: 'compact', options: { threshold: 7 },
    }],
    ['prune keep', ['prune', '--keep', '0'], { command: 'prune', keep: 0 }],
    ['review list ignores later values', ['review', '--list', '--confirm'], {
      command: 'review', mode: 'list',
    }],
    ['review confirm intent and trimmed tags', [
      'review', 'node-1', '--tags', ' alpha, ,beta ', '--confirm', '--intent', 'accepted', '--other', 'value',
    ], {
      command: 'review', mode: 'edit', id: 'node-1', action: 'confirm',
      edits: { intent: 'accepted', tags: ['alpha', 'beta'] },
    }],
    ['review confirm wins when both actions are present', ['review', 'node-1', '--discard', '--confirm'], {
      command: 'review', mode: 'edit', id: 'node-1', action: 'confirm',
    }],
    ['review discard ignores edits', ['review', 'node-1', '--discard', '--intent', 'ignored', '--tags', 'a,b'], {
      command: 'review', mode: 'edit', id: 'node-1', action: 'discard',
    }],
    ['unknown subcommand', ['custom', 'arguments'], { command: 'custom' }],
  ];

  for (const [name, args, expected] of cases) {
    it(`parses ${name} without mutating argv`, () => {
      const original = [...args];
      assert.deepEqual(parseMemoryArgs(args), expected);
      assert.deepEqual(args, original);
    });
  }

  const errors = [
    [['search', '--since', 'not-a-date'], 'invalid --since value: not-a-date'],
    [['search', '--until', 'not-a-date'], 'invalid --until value: not-a-date'],
    [['search', '--since'], 'missing value for --since'],
    [['search', '--limit', '0'], 'invalid --limit value: 0'],
    [['search', '--limit', '1.5'], 'invalid --limit value: 1.5'],
    [['search', '--limit'], 'missing value for --limit'],
    [['export'], 'missing file: guarana memory export <file>'],
    [['import'], 'missing file: guarana memory import <file>'],
    [['compact', '--threshold', '-1'], 'invalid --threshold value: -1'],
    [['compact', '--threshold'], 'missing value for --threshold'],
    [['prune'], 'invalid --keep value: undefined'],
    [['prune', '--keep', '1.5'], 'invalid --keep value: 1.5'],
    [['prune', '--keep'], 'missing value for --keep'],
    [['review'], 'missing node id: guarana memory review <id> --confirm|--discard (or --list)'],
    [['review', '--confirm'], 'missing node id: guarana memory review <id> --confirm|--discard (or --list)'],
    [['review', 'node-1'], 'specify --confirm or --discard'],
    [['review', 'node-1', '--confirm', '--intent'], 'missing value for --intent'],
  ];

  for (const [args, diagnostic] of errors) {
    it(`reports exactly: ${diagnostic}`, () => {
      const original = [...args];
      assert.throws(() => parseMemoryArgs(args), (error) => error.message === diagnostic);
      assert.deepEqual(args, original);
    });
  }
});
