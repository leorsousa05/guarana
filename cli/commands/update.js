const fs = require('fs');
const path = require('path');
const install = require('./install.js');
const { VERSION, SKILLS } = require('../constants.js');
const { STAMP } = require('../lib/guard.js');
const { targetDir } = require('../lib/paths.js');

function colorEnabled() {
  return Boolean(process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb');
}

function paint(text, code, enabled) {
  return enabled ? `\u001b[${code}m${text}\u001b[0m` : text;
}

function formatSummary({ target, useProject, previousVersion, useColor = false }) {
  const version = previousVersion && previousVersion !== VERSION
    ? `${previousVersion} → ${VERSION}`
    : VERSION;
  const lines = [
    paint('Guarana update', '36;1', useColor),
    paint('✓ Update complete', '32;1', useColor),
    `Version    ${version}`,
    `Target     ${useProject ? 'Project' : 'Global'} · ${target}`,
    `Refreshed  ${SKILLS.length} skills · 3 plugins · 3 engines · 3 worker profiles`,
    'Next       Restart OpenCode to load the updated skills',
  ];
  const width = Math.max(38, ...lines.map((line) => line.replace(/\u001b\[[0-9;]*m/g, '').length));
  const border = '─'.repeat(width + 4);
  return [
    paint(`╭${border}╮`, '36;1', useColor),
    ...lines.map((line) => {
      const plain = line.replace(/\u001b\[[0-9;]*m/g, '');
      return `│  ${line}${' '.repeat(width - plain.length)}  │`;
    }),
    paint(`╰${border}╯`, '36;1', useColor),
  ].join('\n');
}

function run(args, { useProject }) {
  const target = targetDir(useProject);
  const stamp = path.join(target, STAMP);
  const previousVersion = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8').trim() : null;

  install.run(args, { useProject, quiet: true });
  console.log(formatSummary({ target, useProject, previousVersion, useColor: colorEnabled() }));
}

module.exports = { run, formatSummary, colorEnabled };
