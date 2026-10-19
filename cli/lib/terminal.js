'use strict';

function isTTY(stream) {
  return Boolean(stream && stream.isTTY);
}

function colorEnabled(stream, env = process.env) {
  return isTTY(stream)
    && !(env.NO_COLOR !== undefined && env.NO_COLOR !== '')
    && env.TERM !== 'dumb';
}

function colorize(text, stream, colorCode, env = process.env) {
  if (!colorEnabled(stream, env)) return text;
  return `\u001b[${colorCode}m${text}\u001b[39m`;
}

function progressLine(stream, message, env = process.env) {
  if (!isTTY(stream)) return;
  stream.write(`${colorize(String(message), stream, '36', env)}\n`);
}

module.exports = { isTTY, colorEnabled, colorize, progressLine };
