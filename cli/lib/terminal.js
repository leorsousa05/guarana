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
  return `\u001b[${colorCode}m${text}\u001b[0m`;
}

function isJsonPayload(text) {
  const trimmed = String(text).trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function formatHelp(text, stream, env = process.env) {
  if (!isTTY(stream)) return text;
  let help = text;
  if (!colorEnabled(stream, env)) return help;
  help = help.replace(/^(guarana \d[^\n]*)$/m, (heading) => colorize(heading, stream, '1;35', env));
  help = help.replace(/^(Usage:|Targets:|Memory vault and search filter:|Plugin targets:|Plugin ownership recovery:|Examples:)$/gm,
    (heading) => colorize(heading, stream, '1;36', env));
  help = help.replace(/^(Advisor fields:|Settings:|Primary:|Workflow settings:|Install\/update:|Uninstall:)(.*)$/gm,
    (_line, heading, detail) => `${colorize(heading, stream, '1;36', env)}${detail}`);
  // Detailed command help begins with a command-specific title, unlike the
  // top-level help title handled above.
  help = help.replace(/^(guarana (?:memory|specs|workflow) —[^\n]*)$/m,
    (heading) => colorize(heading, stream, '1;35', env));
  return help;
}

function formatHumanText(text, stream, env = process.env) {
  const value = String(text);
  if (!isTTY(stream) || isJsonPayload(value)) return value;
  const lines = value.split('\n').map((line) => {
    let rendered = line;
    // Use one ASCII tree vocabulary for collections and lifecycle summaries.
    if (/^  (?:guarana:|plugin:)/.test(rendered)) rendered = `|-- ${rendered.trimStart()}`;
    else if (/^- /.test(rendered)) rendered = `|-- ${rendered.slice(2)}`;
    else if (/^  ! /.test(rendered)) rendered = `|   ! ${rendered.slice(4)}`;
    else if (/^\[(?:decision|bug|solution|refactor|atom|supernode|preference)\]/i.test(rendered) ||
      /^(?:ERROR|WARNING) /.test(rendered)) rendered = `|-- ${rendered}`;
    else if (/^  /.test(rendered)) rendered = `|   ${rendered.slice(2)}`;
    else if (/^(?:installed|updated|uninstalled|removed|preserved|nothing to uninstall|adopted|initialized|exported|imported|deleted|saved|cleared|memory vault already initialized)\b/i.test(rendered)) {
      rendered = `+-- ${rendered}`;
    }

    if (!colorEnabled(stream, env)) return rendered;
    if (/^(?:Guarana update|guarana plugin status|guarana \d)/.test(rendered)) {
      return colorize(rendered, stream, '1;35', env);
    }
    if (/^Validating specs:/.test(rendered)) return colorize(rendered, stream, '1;36', env);
    if (/^[+|\\]--/.test(rendered)) rendered = colorize(rendered.slice(0, 3), stream, '36', env) + rendered.slice(3);
    rendered = rendered.replace(/^(vault|nodes|edges|target|Version|Target|Refreshed|Next|skills):?/,
      (label) => colorize(label, stream, '1;36', env));
    rendered = rendered.replace(/\b(no confirmed matches|no draft nodes|WARNING|FAIL|ERROR|stale|missing|not installed|not deployed|not initialized|setup required|preserved foreign|nothing to uninstall|PASS|installed|updated|uninstalled|initialized|exported|imported|deleted|adopted|confirmed|configured|deployed|ready|saved|cleared|complete|ok \(up to date\)|ok)(?![\w])/g,
      (status) => colorize(status, stream,
        /^(?:FAIL|ERROR)$/i.test(status) ? '31'
          : /^(?:no confirmed matches|no draft nodes)$/i.test(status) ? '90'
            : /^(?:WARNING|stale|missing|not installed|not deployed|not initialized|setup required|preserved foreign|nothing to uninstall)$/i.test(status) ? '33'
              : '32', env));
    return rendered;
  });
  return lines.join('\n');
}

function progressLine(stream, message, env = process.env) {
  if (!isTTY(stream)) return;
  stream.write(`${colorize(String(message), stream, '36', env)}\n`);
}

module.exports = {
  isTTY,
  colorEnabled,
  colorize,
  formatHelp,
  formatHumanText,
  isJsonPayload,
  progressLine,
};
