'use strict';

const settings = require('../lib/advisor-settings.js');
const profiles = require('../lib/advisor-profiles.js');
const profileArtifacts = require('../lib/profile-artifacts.js');
const artifactTransaction = require('../lib/artifact-transaction.js');
const modelCatalog = require('../lib/opencode-model-catalog.js');
const { advisorSettingsTarget } = require('../lib/paths.js');
const { stdoutLine, stderrLine } = require('../lib/io.js');
const { parseAdvisorArgs } = require('./advisor-args.js');

function printStatus(useProject, context = {}) {
  const scoped = settings.readSettings(useProject);
  const effective = settings.effectiveSettings(useProject);
  stdoutLine(context, JSON.stringify({ scope: useProject ? 'project' : 'global', settings: scoped, effective }, null, 2));
  for (const artifact of profiles.advisorArtifactStatus(useProject)) {
    stdoutLine(context, `- ${artifact.name} (${artifact.target}): ${artifact.status}`);
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

async function run(args, { useProject, stdout = process.stdout, stderr = process.stderr } = {}) {
  const context = { stdout, stderr };
  try {
    const parsed = parseAdvisorArgs(args);
    if (parsed.error) throw new Error(parsed.error);
    switch (parsed.command) {
      case 'models': {
        const result = await modelCatalog.discoverModels({ cwd: process.cwd(), provider: parsed.provider });
        stdoutLine(context, JSON.stringify(result.models, null, 2));
        if (result.error) {
          stderrLine(context, `advisor models: ${result.error}`);
          return 1;
        }
        break;
      }
      case 'read':
        printStatus(useProject, context);
        break;
      case 'status':
        printStatus(useProject, context);
        break;
      case 'set': {
        const { field, id } = parsed;
        const [role, key] = field.split('.');
        const current = settings.readSettings(useProject);
        const parsedValue = field === 'advisor.enabled' && ['true', 'false'].includes(id) ? id === 'true' : id;
        const candidate = { ...current, [role]: { ...(current[role] || {}), [key]: parsedValue } };
        settings.validateSettings(candidate);
        const candidateEffective = effectiveCandidate(useProject, candidate);
        if (field === 'advisor.enabled' && parsedValue) {
          if (!candidateEffective.advisor?.provider || !candidateEffective.advisor?.model) throw new Error('enabling Advisor requires advisor.provider and advisor.model');
        }
        const plan = profileArtifacts.preflight(useProject, 'install', null, {
          settingsOverride: candidateEffective,
          groups: ['advisor'],
        });
        const targets = [
          advisorSettingsTarget(useProject),
          ...artifactTransaction.profileTargets(plan),
          plan.manifestFile,
        ];
        const target = artifactTransaction.run(targets, () => {
          const savedTarget = settings.setSetting(useProject, field, parsedValue);
          profiles.installAdvisorArtifacts(useProject, { preflight: plan });
          return savedTarget;
        });
        stdoutLine(context, `saved advisor setting ${field} -> ${target}`);
        break;
      }
      case 'clear': {
        const cleared = clearedCandidate(useProject, parsed.field);
        const candidateEffective = effectiveCandidate(useProject, cleared);
        const plan = profileArtifacts.preflight(useProject, 'install', null, {
          settingsOverride: candidateEffective,
          groups: ['advisor'],
        });
        const targets = [
          advisorSettingsTarget(useProject),
          ...artifactTransaction.profileTargets(plan),
          plan.manifestFile,
        ];
        const target = artifactTransaction.run(targets, () => {
          const clearedTarget = settings.clearSettings(useProject, parsed.field);
          profiles.installAdvisorArtifacts(useProject, { preflight: plan });
          return clearedTarget;
        });
        stdoutLine(context, `cleared advisor settings -> ${target}`);
        break;
      }
    }
    return 0;
  } catch (err) {
    stderrLine(context, `advisor: ${err.message}`);
    return 1;
  }
}

module.exports = { run, printStatus };
