const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { COMMANDS, GLOBAL_FLAGS } = require('./command-metadata.js');

function publicUsageForm(row) {
  // Help rows separate usage from descriptions with either aligned whitespace
  // or the start of a capitalized sentence.
  return row.trim().split(/\s+(?=[A-Z][a-z])/)[0].replace(/\s+/g, ' ');
}

test('README CLI Reference includes every public command form from CLI metadata', () => {
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
    ...COMMANDS.flatMap(({ globalUsage }) => globalUsage),
    ...GLOBAL_FLAGS,
  ]
    .filter((row) => /^\s*guarana\s/.test(row))
    .map(publicUsageForm);
  const missing = expectedForms.filter((form) => !documentedForms.has(form));

  assert.deepEqual(missing, [], 'README omits public CLI usage forms');
});
