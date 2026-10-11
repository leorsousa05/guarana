'use strict';

function parseAdvisorArgs(args) {
  const [subcommand, field, value, ...extra] = args;
  switch (subcommand) {
    case 'models':
      if (value !== undefined || extra.length > 0) {
        return { error: 'usage: guarana advisor models [provider]' };
      }
      return { command: 'models', provider: field };
    case 'read':
    case 'status':
      if (extra.length) return { error: 'unexpected extra arguments' };
      if (field !== undefined || value !== undefined) {
        return { error: `usage: guarana advisor ${subcommand}` };
      }
      return { command: subcommand };
    case 'set':
      if (extra.length) return { error: 'unexpected extra arguments' };
      if (!field || value === undefined) {
        return { error: 'usage: guarana advisor set <field> <id>' };
      }
      return { command: 'set', field, id: value };
    case 'clear':
      if (extra.length) return { error: 'unexpected extra arguments' };
      if (value !== undefined) return { error: 'usage: guarana advisor clear [field]' };
      return { command: 'clear', field };
    default:
      return { error: 'usage: guarana advisor <models|read|set|clear|status>' };
  }
}

module.exports = { parseAdvisorArgs };
