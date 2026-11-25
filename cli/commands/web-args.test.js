'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DASH_DEFAULT_PORT } = require('../constants.js');
const { parseWebArgs } = require('./web-args.js');

test('web argument parser normalizes documented and permissive forms', () => {
  for (const [args, expected] of [
    [[], { port: DASH_DEFAULT_PORT, noOpen: false, portExplicit: false, openExplicit: false, error: null }],
    [['--no-open'], { port: DASH_DEFAULT_PORT, noOpen: true, portExplicit: false, openExplicit: true, error: null }],
    [['--open'], { port: DASH_DEFAULT_PORT, noOpen: false, portExplicit: false, openExplicit: true, error: null }],
    [['--port', '4399'], { port: 4399, noOpen: false, portExplicit: true, openExplicit: false, error: null }],
    [['--port', '4399', '--no-open'], { port: 4399, noOpen: true, portExplicit: true, openExplicit: true, error: null }],
    [['--port', '4100', '--port', '4200'], { port: 4200, noOpen: false, portExplicit: true, openExplicit: false, error: null }],
    [['--port', '4100', '--port', '4200', '--port', '4300'], { port: 4300, noOpen: false, portExplicit: true, openExplicit: false, error: null }],
    [['--unknown', 'ignored', '--no-open'], { port: DASH_DEFAULT_PORT, noOpen: true, portExplicit: false, openExplicit: true, error: null }],
    [['--unknown', '--port', '4321', 'also-ignored'], { port: 4321, noOpen: false, portExplicit: true, openExplicit: false, error: null }],
    [['--port', '0x10'], { port: 16, noOpen: false, portExplicit: true, openExplicit: false, error: null }],
  ]) {
    assert.deepEqual(parseWebArgs(args), expected, JSON.stringify(args));
  }
});

test('web argument parser returns the exact invalid-port diagnostic', () => {
  for (const [args, diagnostic] of [
    [['--port'], 'invalid --port value: undefined'],
    [['--port', '--no-open'], 'invalid --port value: --no-open'],
    [['--port', 'not-a-number'], 'invalid --port value: not-a-number'],
    [['--port', '1.5'], 'invalid --port value: 1.5'],
    [['--port', '0'], 'invalid --port value: 0'],
    [['--port', '65536'], 'invalid --port value: 65536'],
    [['--port', ''], 'invalid --port value: '],
  ]) {
    assert.deepEqual(parseWebArgs(args), {
      port: DASH_DEFAULT_PORT,
      noOpen: false,
      portExplicit: false,
      openExplicit: false,
      error: diagnostic,
    }, JSON.stringify(args));
  }
});

test('web argument parser rejects simultaneous open flags deterministically', () => {
  for (const args of [
    ['--open', '--no-open'],
    ['--no-open', '--open'],
  ]) {
    assert.deepEqual(parseWebArgs(args), {
      port: DASH_DEFAULT_PORT,
      noOpen: false,
      portExplicit: false,
      openExplicit: true,
      error: 'cannot use --open and --no-open together',
    });
  }
});

test('web argument parser does not mutate argv', () => {
  for (const args of [
    ['--port', '4321', '--no-open', 'ignored'],
    ['--no-open', '--port'],
  ]) {
    const original = [...args];
    parseWebArgs(args);
    assert.deepEqual(args, original);
  }
});
