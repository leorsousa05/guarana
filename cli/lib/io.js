'use strict';

const { isTTY, colorize } = require('./terminal.js');

const DIAGNOSTIC_HINT = "Run 'guarana --help' for usage.";

function writeStdout(context, text) {
  (context?.stdout || process.stdout).write(text);
}

function writeStderr(context, text) {
  (context?.stderr || process.stderr).write(text);
}

function stdoutLine(context, text) {
  writeStdout(context, `${text}\n`);
}

function stderrLine(context, text) {
  const stderr = context?.stderr || process.stderr;
  const message = String(text);
  stderr.write(`${colorize(message, stderr, '31')}\n`);
  if (isTTY(stderr) && !message.includes(DIAGNOSTIC_HINT)) stderr.write(`${DIAGNOSTIC_HINT}\n`);
}

module.exports = { writeStdout, writeStderr, stdoutLine, stderrLine };
