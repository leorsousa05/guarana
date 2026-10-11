'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseAdvisorArgs } = require('./advisor-args.js');

test('advisor argument parser normalizes each documented command form', () => {
  for (const [args, expected] of [
    [['models'], { command: 'models', provider: undefined }],
    [['models', 'openai'], { command: 'models', provider: 'openai' }],
    [['models', ''], { command: 'models', provider: '' }],
    [['read'], { command: 'read' }],
    [['status'], { command: 'status' }],
    [['set', 'primary.provider', 'anthropic'], { command: 'set', field: 'primary.provider', id: 'anthropic' }],
    [['set', 'advisor.enabled', 'false'], { command: 'set', field: 'advisor.enabled', id: 'false' }],
    [['set', 'field', ''], { command: 'set', field: 'field', id: '' }],
    [['clear'], { command: 'clear', field: undefined }],
    [['clear', 'advisor.variant'], { command: 'clear', field: 'advisor.variant' }],
    [['clear', ''], { command: 'clear', field: '' }],
  ]) {
    assert.deepEqual(parseAdvisorArgs(args), expected, JSON.stringify(args));
  }
});

test('advisor argument parser preserves exact usage and extra-argument errors', () => {
  for (const [args, error] of [
    [[], 'usage: guarana advisor <models|read|set|clear|status>'],
    [['unknown'], 'usage: guarana advisor <models|read|set|clear|status>'],
    [['models', 'openai', 'gpt-5'], 'usage: guarana advisor models [provider]'],
    [['models', 'openai', 'gpt-5', 'extra'], 'usage: guarana advisor models [provider]'],
    [['read', 'extra'], 'usage: guarana advisor read'],
    [['read', 'one', 'two', 'three'], 'unexpected extra arguments'],
    [['status', 'extra'], 'usage: guarana advisor status'],
    [['status', 'one', 'two', 'three'], 'unexpected extra arguments'],
    [['set'], 'usage: guarana advisor set <field> <id>'],
    [['set', 'primary.provider'], 'usage: guarana advisor set <field> <id>'],
    [['set', '', 'openai'], 'usage: guarana advisor set <field> <id>'],
    [['set', 'primary.provider', 'openai', 'extra'], 'unexpected extra arguments'],
    [['clear', 'advisor.model', 'extra'], 'usage: guarana advisor clear [field]'],
    [['clear', 'advisor.model', 'id', 'extra'], 'unexpected extra arguments'],
  ]) {
    assert.deepEqual(parseAdvisorArgs(args), { error }, JSON.stringify(args));
  }
});

test('advisor argument parser does not mutate argv', () => {
  for (const args of [
    ['models', 'openai'],
    ['set', 'primary.model', 'openai/gpt-5'],
    ['read', 'unexpected'],
  ]) {
    const original = [...args];
    parseAdvisorArgs(args);
    assert.deepEqual(args, original);
  }
});
