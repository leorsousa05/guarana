'use strict';

const PREFERENCES = ['specs', 'verify'];
const BUDGET_PREFERENCE = 'memory.preferenceInjectionBudgetTokens';
const AUTO_INJECT_PREFERENCE = 'memory.autoInject';
const AUTO_ACCEPT_PREFERENCE = 'learningReview.autoAccept';
const LEARNING_ENABLED_PREFERENCE = 'learningReview.enabled';
const ADVISOR_POLICY = 'advisor.consultationPolicy';
const ADVISOR_LIMIT = 'advisor.maxConsultationsPerTask';
const WORKFLOW_USAGE = 'usage: guarana workflow <read|set|clear> [--project]';
const READ_USAGE = 'usage: guarana workflow read [--project]';
const SET_USAGE = 'usage: guarana workflow set <specs|verify|memory.autoInject|learningReview.enabled|learningReview.autoAccept|advisor.consultationPolicy|advisor.maxConsultationsPerTask|memory.preferenceInjectionBudgetTokens> <value> [--project]';
const CLEAR_USAGE = 'usage: guarana workflow clear [specs|verify|memory.autoInject|learningReview.enabled|learningReview.autoAccept|advisor.consultationPolicy|advisor.maxConsultationsPerTask|memory.preferenceInjectionBudgetTokens] [--project]';

function parseWorkflowArgs(args = []) {
  const [subcommand, ...rest] = args;
  const useProject = rest.includes('--project');
  const values = rest.filter((arg) => arg !== '--project');
  if (subcommand === undefined || subcommand === '--help' || subcommand === '-h') {
    return { command: 'help' };
  }

  if (subcommand === 'read') {
    if (values.length) return { error: READ_USAGE };
    return { command: 'read', ...(useProject ? { useProject: true } : {}) };
  }

  if (subcommand === 'set') {
    if (values.length < 2) return { error: SET_USAGE };
    if (values.length > 2) return { error: 'unexpected extra arguments' };
    const [name, value] = values;
    if ([AUTO_INJECT_PREFERENCE, AUTO_ACCEPT_PREFERENCE, LEARNING_ENABLED_PREFERENCE].includes(name)) {
      if (value !== 'true' && value !== 'false') {
        return { error: `invalid boolean value for ${name}: ${value} (expected true or false)` };
      }
      if (name === AUTO_INJECT_PREFERENCE) return { command: 'set-auto-inject', enabled: value === 'true', ...(useProject ? { useProject: true } : {}) };
      if (name === AUTO_ACCEPT_PREFERENCE) return { command: 'set-auto-accept', enabled: value === 'true', ...(useProject ? { useProject: true } : {}) };
      return { command: 'set-field', section: 'learningReview', field: 'enabled', value: value === 'true', ...(useProject ? { useProject: true } : {}) };
    }
    if (name === ADVISOR_POLICY) {
      if (!['manual', 'recommended'].includes(value)) return { error: `invalid value for ${name}: ${value} (expected manual or recommended)` };
      return { command: 'set-field', section: 'advisor', field: 'consultationPolicy', value, ...(useProject ? { useProject: true } : {}) };
    }
    if (name === ADVISOR_LIMIT) {
      const limit = Number(value);
      if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(limit)) return { error: `invalid positive integer for ${name}: ${value}` };
      return { command: 'set-field', section: 'advisor', field: 'maxConsultationsPerTask', value: limit, ...(useProject ? { useProject: true } : {}) };
    }
    if (name === BUDGET_PREFERENCE) {
      const budgetTokens = Number(value);
      if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(budgetTokens)) {
        return { error: `invalid positive integer token budget for ${name}: ${value}` };
      }
      return { command: 'set-budget', budgetTokens, ...(useProject ? { useProject: true } : {}) };
    }
    if (!PREFERENCES.includes(name)) return { error: `unknown workflow preference: ${name}` };
    if (value !== 'true' && value !== 'false') {
      return { error: `invalid boolean value for ${name}: ${value} (expected true or false)` };
    }
    return { command: 'set', name, enabled: value === 'true', ...(useProject ? { useProject: true } : {}) };
  }

  if (subcommand === 'clear') {
    if (values.length > 1) return { error: 'unexpected extra arguments' };
    const [name] = values;
    if (name === AUTO_INJECT_PREFERENCE) return { command: 'clear-auto-inject', ...(useProject ? { useProject: true } : {}) };
    if (name === AUTO_ACCEPT_PREFERENCE) return { command: 'clear-auto-accept', ...(useProject ? { useProject: true } : {}) };
    if (name === LEARNING_ENABLED_PREFERENCE) return { command: 'clear-field', section: 'learningReview', field: 'enabled', ...(useProject ? { useProject: true } : {}) };
    if (name === ADVISOR_POLICY || name === ADVISOR_LIMIT) return { command: 'clear-field', section: 'advisor', field: name.split('.')[1], ...(useProject ? { useProject: true } : {}) };
    if (name !== undefined && name !== BUDGET_PREFERENCE && !PREFERENCES.includes(name)) {
      return { error: `unknown workflow preference: ${name}` };
    }
    return { command: 'clear', name: name === BUDGET_PREFERENCE ? 'memory' : name, ...(useProject ? { useProject: true } : {}) };
  }

  return { error: `unknown workflow command: ${subcommand || '(missing)'}`, usage: WORKFLOW_USAGE };
}

module.exports = { parseWorkflowArgs };
