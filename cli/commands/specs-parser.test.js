'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseSpecsArgs } = require('./specs.js');

const HANDOFF_FILE = '.specs/state/worker-specs-handoff.json';
const RECORD_USAGE = 'usage: guarana specs record --stdin | --file .specs/state/worker-specs-handoff.json';
const VALIDATE_USAGE = 'usage: guarana specs validate [project-root] [--json]';

describe('parseSpecsArgs', () => {
  it('normalizes no args and either help flag', () => {
    for (const args of [[], ['--help'], ['-h']]) {
      assert.deepEqual(parseSpecsArgs(args), { type: 'help' });
    }
  });

  it('parses validate with no root, a root, and --json in either order', () => {
    assert.deepEqual(parseSpecsArgs(['validate']), {
      type: 'validate', projectRoot: null, json: false,
    });
    assert.deepEqual(parseSpecsArgs(['validate', '/project']), {
      type: 'validate', projectRoot: '/project', json: false,
    });
    assert.deepEqual(parseSpecsArgs(['validate', '/project', '--json']), {
      type: 'validate', projectRoot: '/project', json: true,
    });
    assert.deepEqual(parseSpecsArgs(['validate', '--json', '/project']), {
      type: 'validate', projectRoot: '/project', json: true,
    });
  });

  it('preserves duplicate --json flags and treats unknown arguments as project roots', () => {
    assert.deepEqual(parseSpecsArgs(['validate', '--json', '--json']), {
      type: 'validate', projectRoot: null, json: true,
    });
    assert.deepEqual(parseSpecsArgs(['validate', '--unknown']), {
      type: 'validate', projectRoot: '--unknown', json: false,
    });
    assert.deepEqual(parseSpecsArgs(['validate', '--help']), {
      type: 'validate', projectRoot: '--help', json: false,
    });
    assert.deepEqual(parseSpecsArgs(['validate', '/project', '--json', 'extra']), {
      type: 'validate-error', message: VALIDATE_USAGE,
    });
    assert.deepEqual(parseSpecsArgs(['validate', '/project', '/project']), {
      type: 'validate-error', message: VALIDATE_USAGE,
    });
  });

  it('parses the supported record input forms and rejects alternate handoff paths', () => {
    assert.deepEqual(parseSpecsArgs(['record', '--stdin']), {
      type: 'record', source: 'stdin',
    });
    assert.deepEqual(parseSpecsArgs(['record', '--file', HANDOFF_FILE]), {
      type: 'record', source: 'file', file: HANDOFF_FILE,
    });
    assert.deepEqual(parseSpecsArgs(['record', '--file', '../handoff.json']), {
      type: 'record-error', message: `file must be ${HANDOFF_FILE}`,
    });
  });

  it('returns the exact record usage error for every unsupported argument shape', () => {
    for (const args of [
      ['record'],
      ['record', '--stdin', 'extra'],
      ['record', '--file'],
      ['record', '--file', HANDOFF_FILE, 'extra'],
      ['record', 'other'],
    ]) {
      assert.deepEqual(parseSpecsArgs(args), { type: 'record-error', message: RECORD_USAGE }, args.join(' '));
    }
  });

  it('identifies unknown subcommands without treating them as validate arguments', () => {
    assert.deepEqual(parseSpecsArgs(['other', '--json']), { type: 'unknown', subcommand: 'other' });
    assert.deepEqual(parseSpecsArgs(['']), { type: 'unknown', subcommand: '' });
  });
});
