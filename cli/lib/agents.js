const fs = require('fs');
const path = require('path');
const { SOURCE, WORKER_AGENTS } = require('../constants.js');
const { workerAgentsTarget } = require('./paths.js');

const WORKER_MARKER = '<!-- guarana-managed-worker-profile -->';

function skillInstructions(skill) {
  const file = path.join(SOURCE, 'skills', skill, 'SKILL.md');
  const content = fs.readFileSync(file, 'utf8');
  return content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '').trim();
}

function profileText(worker) {
  const editPermission = worker.name === 'worker-code'
      ? '  edit: allow\n'
      : worker.name === 'worker-debug'
      ? '  edit:\n    "*": deny\n    "**/.specs/state/known-issues.md": allow\n'
      : '  edit: deny\n';
  return [
    '---',
    `description: ${worker.description}`,
    'mode: subagent',
    'hidden: true',
    'permission:',
    '  task: deny',
    '  workflow_tick: deny',
    '  read: allow',
    '  grep: allow',
    '  glob: allow',
    '  bash: allow',
    editPermission.trimEnd(),
    '---',
    WORKER_MARKER,
    `# ${worker.name}`,
    '',
    `You are the separate OpenCode Task subagent for ${worker.name}. Perform only the assigned condition. Do not advance the parent workflow state; return your result to the primary agent.`,
    '',
    '## Canonical worker procedure',
    '',
    skillInstructions(worker.skill),
    '',
  ].join('\n');
}

function profiles(useProject) {
  const target = workerAgentsTarget(useProject);
  return WORKER_AGENTS.map((worker) => ({
    ...worker,
    target: path.join(target, `${worker.name}.md`),
    content: profileText(worker),
  }));
}

function assertInstallable(useProject) {
  for (const profile of profiles(useProject)) {
    if (!fs.existsSync(profile.target)) continue;
    const current = fs.readFileSync(profile.target, 'utf8');
    if (current.includes(WORKER_MARKER)) continue;
    if (current === profile.content) continue;
    throw new Error(`refuse to install worker profile: ${profile.target} exists and is not managed by Guarana`);
  }
}

function installWorkerAgents(useProject) {
  assertInstallable(useProject);
  const generated = profiles(useProject);
  if (generated.length) fs.mkdirSync(path.dirname(generated[0].target), { recursive: true });
  for (const profile of generated) fs.writeFileSync(profile.target, profile.content, 'utf8');
  return generated.map(({ name, target }) => ({ name, target }));
}

function uninstallWorkerAgents(useProject) {
  const removed = [];
  const preserved = [];
  for (const profile of profiles(useProject)) {
    if (!fs.existsSync(profile.target)) continue;
    const current = fs.readFileSync(profile.target, 'utf8');
    if (!current.includes(WORKER_MARKER)) {
      preserved.push(profile.target);
      continue;
    }
    fs.unlinkSync(profile.target);
    removed.push(profile.target);
  }
  const target = workerAgentsTarget(useProject);
  try { fs.rmdirSync(target); } catch { /* keep shared/non-empty agent directory */ }
  return { removed, preserved };
}

function workerAgentStatus(useProject) {
  return profiles(useProject).map(({ name, target, content }) => {
    if (!fs.existsSync(target)) return { name, target, status: 'not installed' };
    return {
      name,
      target,
      status: fs.readFileSync(target, 'utf8') === content ? 'ok (up to date)' : 'stale or foreign',
    };
  });
}

module.exports = {
  WORKER_MARKER,
  profileText,
  profiles,
  assertInstallable,
  installWorkerAgents,
  uninstallWorkerAgents,
  workerAgentStatus,
};
