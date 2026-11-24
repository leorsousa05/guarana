'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatHelp, formatHumanText } = require('./terminal.js');

const COLOR_ENV = { NO_COLOR: undefined, TERM: 'xterm-256color' };

test('shares headings, status colors, and ASCII collection grouping on color-capable TTYs', () => {
  const tty = { isTTY: true };
  const text = 'guarana plugin status\n- guarana-memory.js: ok (up to date)\n  ! foreign file';
  const formatted = formatHumanText(text, tty, COLOR_ENV);

  assert.match(formatted, /^\u001b\[1;35mguarana plugin status\u001b\[0m$/m);
  assert.match(formatted, /^\u001b\[36m\|--\u001b\[0m guarana-memory\.js: \u001b\[32mok \(up to date\)\u001b\[0m$/m);
  assert.match(formatted, /^\|   ! foreign file$/m);

  const help = formatHelp('guarana specs — validation\n\nUsage:\n  guarana specs validate', tty, COLOR_ENV);
  assert.match(help, /^\u001b\[1;35mguarana specs — validation\u001b\[0m$/m);
  assert.match(help, /^\u001b\[1;36mUsage:\u001b\[0m$/m);
});

test('keeps redirected bytes exact and suppresses ANSI for NO_COLOR and TERM=dumb', () => {
  const text = 'installed guarana\n  guarana:plan';
  assert.equal(formatHumanText(text, { isTTY: false }, COLOR_ENV), text);
  assert.equal(formatHelp('guarana specs — help\n\nUsage:\n', { isTTY: false }, COLOR_ENV),
    'guarana specs — help\n\nUsage:\n');

  for (const env of [
    { NO_COLOR: '1', TERM: 'xterm-256color' },
    { NO_COLOR: undefined, TERM: 'dumb' },
  ]) {
    const output = formatHumanText(text, { isTTY: true }, env);
    assert.doesNotMatch(output, /\u001b\[/);
    assert.equal(output, '+-- installed guarana\n|-- guarana:plan');
  }
});

test('leaves valid JSON payloads untouched even on a color-capable TTY', () => {
  const json = '{\n  "ok": true,\n  "items": ["ready"]\n}';
  assert.equal(formatHumanText(json, { isTTY: true }, COLOR_ENV), json);
});
