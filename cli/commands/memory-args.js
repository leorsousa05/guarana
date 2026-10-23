'use strict';

function fail(message) {
  throw new Error(message);
}

function parseFlags(args, spec) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const key = spec[args[i]];
    if (key !== undefined) {
      const value = args[++i];
      if (value === undefined) fail(`missing value for ${args[i - 1]}`);
      out[key] = value;
    }
  }
  return out;
}

function parseTime(value, flag) {
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  const date = Date.parse(value);
  if (Number.isNaN(date)) fail(`invalid ${flag} value: ${value}`);
  return date;
}

function parseMemoryArgs(args) {
  const subcommand = args[0];
  if (subcommand === undefined || subcommand === '--help' || subcommand === '-h') {
    return { command: 'help' };
  }

  if (subcommand === 'search') {
    const term = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
    const flags = parseFlags(args.slice(term ? 2 : 1), {
      '--type': 'type', '--project': 'project', '--since': 'since', '--until': 'until', '--limit': 'limit',
    });
    const options = { query: term, type: flags.type, project: flags.project };
    if (flags.since !== undefined) options.since = parseTime(flags.since, '--since');
    if (flags.until !== undefined) options.until = parseTime(flags.until, '--until');
    if (flags.limit !== undefined) {
      options.limit = Number(flags.limit);
      if (!Number.isInteger(options.limit) || options.limit < 1) fail(`invalid --limit value: ${flags.limit}`);
    }
    return { command: 'search', term, options };
  }

  if (subcommand === 'export' || subcommand === 'import') {
    const file = args[1];
    if (!file) fail(`missing file: guarana memory ${subcommand} <file>`);
    return { command: subcommand, file };
  }

  if (subcommand === 'compact') {
    const flags = parseFlags(args.slice(1), { '--threshold': 'threshold' });
    const options = {};
    if (flags.threshold !== undefined) {
      const threshold = Number(flags.threshold);
      if (!Number.isInteger(threshold) || threshold < 0) fail(`invalid --threshold value: ${flags.threshold}`);
      options.threshold = threshold;
    }
    return { command: 'compact', options };
  }

  if (subcommand === 'prune') {
    const flags = parseFlags(args.slice(1), { '--keep': 'keep' });
    const keep = Number(flags.keep);
    if (!Number.isInteger(keep) || keep < 0) fail(`invalid --keep value: ${flags.keep}`);
    return { command: 'prune', keep };
  }

  if (subcommand === 'review') {
    if (args[1] === '--list') return { command: 'review', mode: 'list' };
    const id = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
    if (!id) fail('missing node id: guarana memory review <id> --confirm|--discard (or --list)');
    const rest = args.slice(2);
    const action = rest.includes('--confirm') ? 'confirm' : rest.includes('--discard') ? 'discard' : undefined;
    if (!action) fail('specify --confirm or --discard');
    const flags = parseFlags(rest.filter((arg) => arg !== '--confirm' && arg !== '--discard'), {
      '--intent': 'intent', '--tags': 'tags',
    });
    const result = { command: 'review', mode: 'edit', id, action };
    if (action === 'confirm' && (flags.intent !== undefined || flags.tags !== undefined)) {
      result.edits = {};
      if (flags.intent !== undefined) result.edits.intent = flags.intent;
      if (flags.tags !== undefined) {
        result.edits.tags = flags.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
      }
    }
    return result;
  }

  if (subcommand === 'delete') {
    const id = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
    if (!id) fail('missing node id: guarana memory delete <id> --scope project|global --confirm');
    const rest = args.slice(2);
    const flags = parseFlags(rest, { '--scope': 'scope' });
    if (!flags.scope) fail('memory delete requires --scope project|global');
    if (flags.scope !== 'project' && flags.scope !== 'global') fail(`invalid --scope value: ${flags.scope}`);
    if (!rest.includes('--confirm')) fail('memory delete requires explicit --confirm');
    return { command: 'delete', id, scope: flags.scope, confirm: true };
  }

  return { command: subcommand };
}

module.exports = { parseMemoryArgs };
