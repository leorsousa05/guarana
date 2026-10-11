const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('./args.js');

describe('parseArgs', () => {
  it('returns no command for empty argv', () => {
    assert.deepEqual(parseArgs([]), { command: undefined, commandArgs: [], useProject: false });
  });

  it('returns the command and remaining args', () => {
    assert.deepEqual(parseArgs(['install', 'before', '--verbose']), {
      command: 'install',
      commandArgs: ['before', '--verbose'],
      useProject: false,
    });
  });

  it('removes global project flags before and after non-memory commands', () => {
    assert.deepEqual(parseArgs(['--project', 'install', 'before', '--project', 'after']), {
      command: 'install',
      commandArgs: ['before', 'after'],
      useProject: true,
    });
  });

  it('preserves a project flag after memory search as a nested filter', () => {
    assert.deepEqual(parseArgs(['memory', 'search', '--project', 'HASH']), {
      command: 'memory',
      commandArgs: ['search', '--project', 'HASH'],
      useProject: false,
    });
  });

  it('supports global and memory project selectors together', () => {
    assert.deepEqual(parseArgs(['--project', 'memory', 'search', '--project', 'HASH']), {
      command: 'memory',
      commandArgs: ['search', '--project', 'HASH'],
      useProject: true,
    });
  });

  it('removes a project flag between memory and search as a global selector', () => {
    assert.deepEqual(parseArgs(['memory', '--project', 'search', 'term']), {
      command: 'memory',
      commandArgs: ['search', 'term'],
      useProject: true,
    });
  });

  it('keeps project flags global for other memory subcommands', () => {
    assert.deepEqual(parseArgs(['memory', 'compact', '--project']), {
      command: 'memory',
      commandArgs: ['compact'],
      useProject: true,
    });
  });

  it('does not mutate argv', () => {
    const argv = ['--project', 'install', '--project', 'target'];
    const originalArgv = [...argv];

    parseArgs(argv);

    assert.deepEqual(argv, originalArgv);
  });
});
