'use strict';

const path = require('node:path');
const { validateSpecs } = require('../lib/specs-validator.js');

const HELP = `guarana specs — deterministic .specs validation

Usage:
  guarana specs validate [project-root] [--json]
    Check required files, tracker/state structure, feature acceptance sections,
    ADR format, and local Markdown links. Exit code is 1 when errors are found.
`;

function run(args) {
  const [sub, ...rest] = args;
  if (sub === '--help' || sub === '-h') {
    process.stdout.write(HELP);
    return;
  }
  if (sub !== 'validate') {
    console.error(`unknown specs command: ${sub || '(missing)'}`);
    process.stdout.write(HELP);
    process.exitCode = 1;
    return;
  }

  const json = rest.includes('--json');
  const roots = rest.filter((arg) => arg !== '--json');
  if (roots.length > 1) {
    console.error('usage: guarana specs validate [project-root] [--json]');
    process.exitCode = 1;
    return;
  }
  const result = validateSpecs(path.resolve(roots[0] || process.cwd()));
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Validating specs: ${path.join(result.root, '.specs')}`);
    console.log(`${result.filesScanned} Markdown file(s), ${result.featureSpecs} feature spec(s), ${result.adrs} ADR(s), ${result.linksChecked} local link(s)`);
    for (const issue of result.issues) {
      const location = issue.file ? `${issue.file}: ` : '';
      console.log(`${issue.severity.toUpperCase()} ${location}${issue.message}`);
    }
    if (result.ok) console.log('PASS: specs structure and local references are consistent.');
    else console.log(`FAIL: ${result.issues.filter((issue) => issue.severity === 'error').length} error(s), ${result.issues.filter((issue) => issue.severity === 'warning').length} warning(s).`);
  }
  if (!result.ok) process.exitCode = 1;
}

module.exports = { run, HELP };
