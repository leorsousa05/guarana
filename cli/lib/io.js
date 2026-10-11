'use strict';

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
  writeStderr(context, `${text}\n`);
}

module.exports = { writeStdout, writeStderr, stdoutLine, stderrLine };
