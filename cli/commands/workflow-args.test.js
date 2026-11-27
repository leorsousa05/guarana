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
    [['set', 'memory.autoInject', 'false'], { command: 'set-auto-inject', enabled: false }],
    [['set', 'learningReview.autoAccept', 'false'], { command: 'set-auto-accept', enabled: false }],
    [['set', 'learningReview.enabled', 'true'], { command: 'set-field', section: 'learningReview', field: 'enabled', value: true }],
    [['set', 'advisor.consultationPolicy', 'manual'], { command: 'set-field', section: 'advisor', field: 'consultationPolicy', value: 'manual' }],
    [['set', 'advisor.maxConsultationsPerTask', '5'], { command: 'set-field', section: 'advisor', field: 'maxConsultationsPerTask', value: 5 }],
    [['set', 'memory.preferenceInjectionBudgetTokens', '1024'], { command: 'set-budget', budgetTokens: 1024 }],
    [['clear'], { command: 'clear', name: undefined }],
    [['clear', 'specs'], { command: 'clear', name: 'specs' }],
    [['clear', 'verify'], { command: 'clear', name: 'verify' }],
    [['clear', 'memory.autoInject'], { command: 'clear-auto-inject' }],
    [['clear', 'learningReview.autoAccept'], { command: 'clear-auto-accept' }],
    [['clear', 'learningReview.enabled'], { command: 'clear-field', section: 'learningReview', field: 'enabled' }],
    [['clear', 'advisor.consultationPolicy'], { command: 'clear-field', section: 'advisor', field: 'consultationPolicy' }],
    [['clear', 'memory.preferenceInjectionBudgetTokens'], { command: 'clear', name: 'memory' }],
  ]) {
    assert.deepEqual(parseWorkflowArgs(args), expected, JSON.stringify(args));
  }
});

test('workflow parser recognizes --project for read, set, and clear', () => {
  assert.deepEqual(parseWorkflowArgs(['read', '--project']), { command: 'read', useProject: true });
  assert.deepEqual(parseWorkflowArgs(['set', 'learningReview.autoAccept', 'true', '--project']), {
    command: 'set-auto-accept', enabled: true, useProject: true,
  });
  assert.deepEqual(parseWorkflowArgs(['clear', 'learningReview.autoAccept', '--project']), {
    command: 'clear-auto-accept', useProject: true,
  });
});

test('workflow parser rejects unknown commands and fields, invalid booleans, and extra args', () => {
  for (const [args, expected] of [
    [['bogus'], { error: 'unknown workflow command: bogus', usage: 'usage: guarana workflow <read|set|clear> [--project]' }],
    [['read', 'extra'], { error: 'usage: guarana workflow read [--project]' }],
     [['set'], { error: 'usage: guarana workflow set <specs|verify|memory.autoInject|learningReview.enabled|learningReview.autoAccept|advisor.consultationPolicy|advisor.maxConsultationsPerTask|memory.preferenceInjectionBudgetTokens> <value> [--project]' }],
     [['set', 'specs'], { error: 'usage: guarana workflow set <specs|verify|memory.autoInject|learningReview.enabled|learningReview.autoAccept|advisor.consultationPolicy|advisor.maxConsultationsPerTask|memory.preferenceInjectionBudgetTokens> <value> [--project]' }],
    [['set', 'other', 'true'], { error: 'unknown workflow preference: other' }],
    [['set', 'verify', 'False'], { error: 'invalid boolean value for verify: False (expected true or false)' }],
    [['set', 'verify', '1'], { error: 'invalid boolean value for verify: 1 (expected true or false)' }],
    [['set', 'memory.autoInject', '1'], { error: 'invalid boolean value for memory.autoInject: 1 (expected true or false)' }],
    [['set', 'memory.preferenceInjectionBudgetTokens', '0'], { error: 'invalid positive integer token budget for memory.preferenceInjectionBudgetTokens: 0' }],
    [['set', 'memory.preferenceInjectionBudgetTokens', '1.5'], { error: 'invalid positive integer token budget for memory.preferenceInjectionBudgetTokens: 1.5' }],
    [['set', 'advisor.consultationPolicy', 'always'], { error: 'invalid value for advisor.consultationPolicy: always (expected manual or recommended)' }],
    [['set', 'advisor.maxConsultationsPerTask', '0'], { error: 'invalid positive integer for advisor.maxConsultationsPerTask: 0' }],
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
