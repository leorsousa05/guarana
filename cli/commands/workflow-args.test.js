'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseWorkflowArgs } = require('./workflow-args.js');

test('workflow parser normalizes the documented commands and boolean values', () => {
  for (const [args, expected] of [
    [[], { command: 'help' }],
    [['--help'], { command: 'help' }],
    [['-h'], { command: 'help' }],
    [['read'], { command: 'read' }],
    [['set', 'specs', 'true'], { command: 'set', name: 'specs', enabled: true }],
    [['set', 'verify', 'false'], { command: 'set', name: 'verify', enabled: false }],
    [['clear'], { command: 'clear', name: undefined }],
    [['clear', 'specs'], { command: 'clear', name: 'specs' }],
  ]) {
    assert.deepEqual(parseWorkflowArgs(args), expected, JSON.stringify(args));
  }
});

test('workflow parser rejects unknown commands and fields, invalid booleans, and extra args', () => {
  for (const [args, expected] of [
    [['bogus'], { error: 'unknown workflow command: bogus', usage: 'usage: guarana workflow <read|set|clear> [--project]' }],
    [['read', 'extra'], { error: 'usage: guarana workflow read [--project]' }],
    [['set'], { error: 'usage: guarana workflow set <specs|verify> <true|false> [--project]' }],
    [['set', 'specs'], { error: 'usage: guarana workflow set <specs|verify> <true|false> [--project]' }],
    [['set', 'other', 'true'], { error: 'unknown workflow preference: other' }],
    [['set', 'verify', 'False'], { error: 'invalid boolean value for verify: False (expected true or false)' }],
    [['set', 'verify', '1'], { error: 'invalid boolean value for verify: 1 (expected true or false)' }],
    [['set', 'verify', 'true', 'extra'], { error: 'unexpected extra arguments' }],
    [['clear', 'other'], { error: 'unknown workflow preference: other' }],
    [['clear', 'specs', 'verify'], { error: 'unexpected extra arguments' }],
  ]) {
    assert.deepEqual(parseWorkflowArgs(args), expected, JSON.stringify(args));
  }
});

test('workflow parser does not mutate arguments and requires literal boolean strings', () => {
  for (const args of [
    ['read', 'extra'],
    ['set', 'specs', 'false'],
    ['clear', 'verify'],
  ]) {
    const original = [...args];
    parseWorkflowArgs(args);
    assert.deepEqual(args, original);
  }
  assert.deepEqual(parseWorkflowArgs(['set', 'specs', false]), {
    error: 'invalid boolean value for specs: false (expected true or false)',
  });
});
