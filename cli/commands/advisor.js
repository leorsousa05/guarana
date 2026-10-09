'use strict';

const settings = require('../lib/advisor-settings.js');
const profiles = require('../lib/advisor-profiles.js');
const modelCatalog = require('../lib/opencode-model-catalog.js');

function printStatus(useProject) {
  const scoped = settings.readSettings(useProject);
  const effective = settings.effectiveSettings(useProject);
  console.log(JSON.stringify({ scope: useProject ? 'project' : 'global', settings: scoped, effective }, null, 2));
  for (const artifact of profiles.advisorArtifactStatus(useProject)) {
    console.log(`- ${artifact.name} (${artifact.target}): ${artifact.status}`);
  }
}

function effectiveCandidate(useProject, candidate) {
  return useProject
    ? settings.mergeSettings(candidate, settings.readSettings(false))
    : candidate;
}

function clearedCandidate(useProject, field) {
  const current = settings.readSettings(useProject);
  if (field === undefined) return {};
  const candidate = { ...current };
  const [role, key] = field.split('.');
  if (candidate[role]) {
    candidate[role] = { ...candidate[role] };
    delete candidate[role][key];
    if (!Object.keys(candidate[role]).length) delete candidate[role];
  }
  return candidate;
}

async function run(args, { useProject }) {
  try {
    const [subcommand, field, value, ...extra] = args;
    switch (subcommand) {
      case 'models': {
        if (value !== undefined || extra.length > 0) throw new Error('usage: guarana advisor models [provider]');
        const result = await modelCatalog.discoverModels({ cwd: process.cwd(), provider: field });
        console.log(JSON.stringify(result.models, null, 2));
        if (result.error) {
          console.error(`advisor models: ${result.error}`);
          process.exitCode = 1;
        }
        break;
      }
      case 'read':
        if (extra.length) throw new Error('unexpected extra arguments');
        if (field !== undefined || value !== undefined) throw new Error('usage: guarana advisor read');
        printStatus(useProject);
        break;
      case 'status':
        if (extra.length) throw new Error('unexpected extra arguments');
        if (field !== undefined || value !== undefined) throw new Error('usage: guarana advisor status');
        printStatus(useProject);
        break;
      case 'set':
        if (extra.length) throw new Error('unexpected extra arguments');
        if (!field || value === undefined) throw new Error('usage: guarana advisor set <field> <id>');
        const [role, key] = field.split('.');
        const current = settings.readSettings(useProject);
        const parsedValue = field === 'advisor.enabled' && ['true', 'false'].includes(value) ? value === 'true' : value;
        const candidate = { ...current, [role]: { ...(current[role] || {}), [key]: parsedValue } };
        settings.validateSettings(candidate);
        if (field === 'advisor.enabled' && parsedValue) {
          const effective = effectiveCandidate(useProject, candidate);
          if (!effective.advisor?.provider || !effective.advisor?.model) throw new Error('enabling Advisor requires advisor.provider and advisor.model');
        }
        profiles.assertInstallable(useProject, { settingsOverride: effectiveCandidate(useProject, candidate) });
        console.log(`saved advisor setting ${field} -> ${settings.setSetting(useProject, field, parsedValue)}`);
        profiles.installAdvisorArtifacts(useProject);
        break;
      case 'clear':
        if (extra.length) throw new Error('unexpected extra arguments');
        if (value !== undefined) throw new Error('usage: guarana advisor clear [field]');
        const cleared = clearedCandidate(useProject, field);
        profiles.assertInstallable(useProject, { settingsOverride: effectiveCandidate(useProject, cleared) });
        console.log(`cleared advisor settings -> ${settings.clearSettings(useProject, field)}`);
        profiles.installAdvisorArtifacts(useProject);
        break;
      default:
        throw new Error('usage: guarana advisor <models|read|set|clear|status>');
    }
  } catch (err) {
    console.error(`advisor: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { run, printStatus };
