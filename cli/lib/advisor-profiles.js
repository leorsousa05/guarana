'use strict';

const fs = require('fs');
const { advisorCommandTarget, advisorAgentsTarget, advisorSubagentTarget } = require('./paths.js');
const { effectiveSettings, isConfigured, isAdvisorConfigured } = require('./advisor-settings.js');

const ADVISOR_MARKER = '<!-- guarana-managed-advisor-artifact -->';
const PROFILE_NAMES = ['command', 'primary agent', 'advisor agent'];

function modelFields(section) {
  return [
    `model: ${JSON.stringify(`${section.provider}/${section.model}`)}`,
    ...(section.variant ? [`variant: ${JSON.stringify(section.variant)}`] : []),
  ];
}

function artifacts(useProject, options = {}) {
  const settings = options.settingsOverride || effectiveSettings(useProject, options);
  const configured = isConfigured(settings);
  const advisorConfigured = isAdvisorConfigured(settings);
  const command = [
    '---',
    configured
      ? 'description: Start a task with Guarana primary defaults; OpenCode session selections prevail'
      : 'description: Set up the required Guarana primary model IDs',
    ...(configured ? ['agent: guarana'] : []),
    '---',
    ADVISOR_MARKER,
    ...(configured ? [
      'Run the request below through the configured Guarana primary profile.',
      'Preserve Guarana orchestration, workflow transitions, and normal native Task worker dispatch while completing the request.',
      '',
      '$ARGUMENTS',
      '',
    ] : [
      'This is a setup-only command because the primary provider/model IDs are incomplete.',
      'Do not inspect, analyze, plan, execute, edit, delegate, or claim completion of the submitted task. Do not bind to a model-less primary or run the task with the active/default model.',
      'Tell the user to choose valid IDs from `opencode models`, then run these commands (replace each placeholder with an actual ID):',
      '',
      '```sh',
      'guarana advisor set primary.provider <provider-id>',
      'guarana advisor set primary.model <model-id>',
      'guarana advisor read',
      '```',
      'After both Primary fields are configured, invoke `/guarana-advisor` again with the task. Advisor consultation is optional; enable it with `guarana advisor set advisor.enabled true` after configuring its provider/model.',
      '',
    ]),
  ].join('\n');
  if (!configured) {
    return [{ name: PROFILE_NAMES[0], target: advisorCommandTarget(useProject, options.projectRoot), content: command }];
  }
  const primary = [
    '---',
    'description: Guarana primary profile defaults; OpenCode session selections prevail',
    'mode: primary',
    ...modelFields(settings.primary),
    '---',
    ADVISOR_MARKER,
    '# Guarana primary',
    '',
    'You are the default Guarana primary. Own execution of requests and follow the existing Guarana workflow, including task planning, native Task worker dispatch, verification, and state transitions.',
    'The configured model and variant are agent/profile defaults only. Explicit or remembered OpenCode session model/variant selections prevail; do not override them to match this profile.',
    'Advisor consultation is permitted only when advisor.enabled is true and the configured read-only advisor is available. You remain responsible for decisions, edits, task dispatch, and every workflow_tick. Never delegate execution or workflow ownership to the advisor.',
    '',
    ...(advisorConfigured ? [
      'For substantial or ambiguous tasks, consider proactively consulting the native Task subagent guarana-advisor during planning when a meaningful question, assumption, risk, architecture choice, or trade-off would benefit from advice. Keep trivial and routine tasks consultation-free.',
      'At later consequential stages—including execution, debugging, or verification—consult only when advice could materially help; do not wait until blocked. Relevant failures or retries are also valid reasons when they show you are blocked, but do not consult for failures from which you have recovered.',
    ] : [
      'Advisor consultation is unavailable unless advisor.enabled is true and a configured read-only advisor is available. Do not consult or encourage consultation while Advisor is disabled or unconfigured.',
    ]),
    'For a consultation, send only a concise summary containing the request/goal, current workflow state and progress, meaningful attempts already made, and the exact relevant failure/tool output. Do not forward the full conversation or unrelated data.',
    'When consulting guarana-advisor, set the native Task description to a brief reason advice is needed now (3–5 words), not the overall task title. Include no secrets or IDs; keep the bounded summary in the Task prompt unchanged.',
    'Ask only for feasible next steps, tradeoffs, limitations, and uncertainty based on that summary. Make at most one Task consultation for an unchanged context; do not repeat the same consultation. A materially different question or blocker may be considered only after meaningful progress or new evidence.',
    'Use any recommendations as advice, decide what to do yourself, then continue the existing workflow. If Task is unavailable, denied, or fails, say clearly that no advisor recommendation was obtained; continue independently if feasible or ask the user. Never invent advice or claim a handoff succeeded when it did not.',
    '',
  ].join('\n');
  const advisor = advisorConfigured ? [
    '---',
    'description: Read-only advisor that returns options and limitations to the Guarana primary',
    'mode: subagent',
    'hidden: true',
    ...modelFields(settings.advisor),
    'permission:',
    '  "*": deny',
    '  task: deny',
    '  workflow_tick: deny',
    '  read: allow',
    '  grep: allow',
    '  glob: allow',
    '  edit: deny',
    '  write: deny',
    '  bash: deny',
    '---',
    ADVISOR_MARKER,
    '# Guarana read-only advisor',
    '',
    'Based only on the concise summary supplied by the primary, return feasible next steps, relevant tradeoffs/limitations, and uncertainty. Keep recommendations advisory and bounded to the request.',
    'Do not edit files, run commands, dispatch tasks, advance workflow state, or claim to have made changes. State when the summary is insufficient instead of guessing.',
    '',
  ].join('\n') : null;
  return [
    { name: PROFILE_NAMES[0], target: advisorCommandTarget(useProject, options.projectRoot), content: command },
    { name: PROFILE_NAMES[1], target: advisorAgentsTarget(useProject, options.projectRoot), content: primary },
    ...(advisorConfigured ? [{ name: PROFILE_NAMES[2], target: advisorSubagentTarget(useProject, options.projectRoot), content: advisor }] : []),
  ];
}

function managedTargets(useProject, options = {}) {
  return [
    { name: PROFILE_NAMES[0], target: advisorCommandTarget(useProject, options.projectRoot) },
    { name: PROFILE_NAMES[1], target: advisorAgentsTarget(useProject, options.projectRoot) },
    { name: PROFILE_NAMES[2], target: advisorSubagentTarget(useProject, options.projectRoot) },
  ];
}

function assertInstallable(useProject, options = {}) {
  require('./profile-artifacts.js').preflight(useProject, 'install', null, { ...options, groups: ['advisor'] });
}

function preflightInstall(useProject, options = {}) {
  return require('./profile-artifacts.js').preflight(useProject, 'install', null, { ...options, groups: ['advisor'] });
}

function installAdvisorArtifacts(useProject, options = {}) {
  return require('./profile-artifacts.js').installAdvisorArtifacts(useProject, options);
}

function uninstallAdvisorArtifacts(useProject, options = {}) {
  return require('./profile-artifacts.js').uninstallAdvisorArtifacts(useProject, options);
}

function advisorArtifactStatus(useProject, options = {}) {
  const expected = artifacts(useProject, options);
  const configured = isConfigured(effectiveSettings(useProject, options));
  const byTarget = new Map(expected.map((artifact) => [artifact.target, artifact.content]));
  const targets = managedTargets(useProject, options);
  return targets.map(({ name, target }) => {
    if (!fs.existsSync(target)) return { name, target, status: configured || name === 'command' ? 'not installed' : 'settings incomplete' };
    const current = fs.readFileSync(target, 'utf8');
    if (!current.includes(ADVISOR_MARKER)) return { name, target, status: 'foreign' };
    if (!byTarget.has(target)) return { name, target, status: 'settings incomplete' };
    return { name, target, status: current === byTarget.get(target) ? 'ok (up to date)' : 'stale (managed by Guarana)' };
  });
}

module.exports = { ADVISOR_MARKER, artifacts, managedTargets, assertInstallable, preflightInstall, installAdvisorArtifacts, uninstallAdvisorArtifacts, advisorArtifactStatus };
