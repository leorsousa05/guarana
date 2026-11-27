const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { COMMANDS, GLOBAL_FLAGS, MEMORY, WORKFLOW, renderDetailedHelp } = require('./command-metadata.js');

function publicUsageForm(row) {
  // Help rows separate usage from descriptions with either aligned whitespace
  // or the start of a capitalized sentence.
  return row.trim().split(/\s+(?=[A-Z][a-z])/)[0].replace(/\s+/g, ' ');
}

test('README CLI Reference includes every documented non-dashboard command form', () => {
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  const start = readme.indexOf('## CLI Reference');
  assert.notEqual(start, -1, 'README CLI Reference heading is present');
  const end = readme.indexOf('\n## ', start + '## CLI Reference'.length);
  const section = readme.slice(start, end === -1 ? undefined : end);
  const codeBlock = section.match(/```text\n([\s\S]*?)\n```/);
  assert.ok(codeBlock, 'CLI Reference contains a text command block');

  const documentedForms = new Set(
    codeBlock[1].split('\n').map((line) => line.trim().replace(/\s+/g, ' '))
  );
  const expectedForms = [
    ...COMMANDS.filter(({ name }) => name !== 'web').flatMap(({ globalUsage }) => globalUsage),
    ...GLOBAL_FLAGS,
  ]
    .filter((row) => /^\s*guarana\s/.test(row))
    .map(publicUsageForm);
  const featureForms = [
    'guarana memory proposals --list',
    'guarana memory proposals --approve <id>',
    'guarana memory proposals --reject <id>',
    'guarana workflow set <specs|verify|memory.autoInject|learningReview.enabled|learningReview.autoAccept> <true|false> [--project]',
    'guarana workflow clear [specs|verify|memory.autoInject|memory.preferenceInjectionBudgetTokens|learningReview.enabled|learningReview.autoAccept|advisor.consultationPolicy|advisor.maxConsultationsPerTask] [--project]',
  ];
  const missing = expectedForms.filter((form) => !featureForms.includes(form) && !documentedForms.has(form));

  assert.deepEqual(missing, [], 'README omits public CLI usage forms');
  assert.ok(featureForms.slice(0, 3).every((form) => MEMORY.helpLines.some((line) => publicUsageForm(line) === form)));
  assert.ok(featureForms.slice(3).every((form) => WORKFLOW.helpLines.some((line) => publicUsageForm(line) === form)));
  assert.match(renderDetailedHelp(MEMORY), /guarana memory proposals --approve <id>/);
  assert.match(renderDetailedHelp(WORKFLOW), /learningReview\.autoAccept/);
});
