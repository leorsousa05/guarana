'use strict';

const PREFERENCES = ['specs', 'verify'];
const WORKFLOW_USAGE = 'usage: guarana workflow <read|set|clear> [--project]';
const READ_USAGE = 'usage: guarana workflow read [--project]';
const SET_USAGE = 'usage: guarana workflow set <specs|verify> <true|false> [--project]';
const CLEAR_USAGE = 'usage: guarana workflow clear [specs|verify] [--project]';

function parseWorkflowArgs(args = []) {
  const [subcommand, ...rest] = args;
  if (subcommand === undefined || subcommand === '--help' || subcommand === '-h') {
    return { command: 'help' };
  }

  if (subcommand === 'read') {
    if (rest.length) return { error: READ_USAGE };
    return { command: 'read' };
  }

  if (subcommand === 'set') {
    if (rest.length < 2) return { error: SET_USAGE };
    if (rest.length > 2) return { error: 'unexpected extra arguments' };
    const [name, value] = rest;
    if (!PREFERENCES.includes(name)) return { error: `unknown workflow preference: ${name}` };
    if (value !== 'true' && value !== 'false') {
      return { error: `invalid boolean value for ${name}: ${value} (expected true or false)` };
    }
    return { command: 'set', name, enabled: value === 'true' };
  }

  if (subcommand === 'clear') {
    if (rest.length > 1) return { error: 'unexpected extra arguments' };
    const [name] = rest;
    if (name !== undefined && !PREFERENCES.includes(name)) {
      return { error: `unknown workflow preference: ${name}` };
    }
    return { command: 'clear', name };
  }

  return { error: `unknown workflow command: ${subcommand || '(missing)'}`, usage: WORKFLOW_USAGE };
}

module.exports = { parseWorkflowArgs };
