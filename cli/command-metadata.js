'use strict';

const MEMORY = {
  title: 'guarana memory — project-local memory vault (.guarana/memory/)',
  sections: [
    { rows: ['  guarana memory init                    Create .guarana/memory/ (idempotent) + .gitignore entry'] },
    { rows: ['  guarana memory status                  Show node/edge counts and legacy draft vs confirmed breakdown'] },
    {
      rows: [
        '  guarana memory search [term] [flags]   Search confirmed nodes (drafts are never returned)',
        '    --type <type>        Filter by node type (decision|bug|solution|refactor|atom|supernode)',
        '    --project <hash>     Filter by project hash',
        '    --since <date|ms>    Only nodes with ts >= value',
        '    --until <date|ms>    Only nodes with ts <= value',
        '    --limit <n>          Max results (default 20)',
      ],
    },
    { rows: ['  guarana memory export <file>           Export the vault to a JSON file'] },
    { rows: ['  guarana memory import <file>           Import a vault JSON file (replaces nodes/edges)'] },
    {
      rows: ['  guarana memory compact [--threshold <n>]  Collapse oldest atom nodes into a supernode (lessons/decisions preserved)'],
      details: ['    (default threshold from config.json compactionThreshold; atom nodes only — decisions/bugs/etc. never compacted)'],
    },
    { rows: ['  guarana memory prune --keep <n>        Drop oldest legacy DRAFT atom nodes beyond n'] },
    { rows: ['  guarana memory review --list           List legacy draft nodes (id, type, intent, ts), most recent first'] },
    { rows: ['  guarana memory review <id> --confirm   Migrate a legacy draft (optional edits: --intent "..." --tags a,b)'] },
    { rows: ['  guarana memory review <id> --discard   Remove a legacy draft node and its edges'] },
    { rows: ['  guarana memory delete <id> --scope <project|global> --confirm  Hard-delete one confirmed node and its edges'] },
    { rows: ['  guarana memory --help                  Show this help'] },
    { rows: ['  guarana memory -h                      Show this help'] },
  ],
};

const SPECS = {
  title: 'guarana specs — deterministic .specs validation and record updates',
  sections: [
    {
      rows: ['  guarana specs validate [project-root] [--json]'],
      details: [
        '    Check required files, tracker/state structure, feature acceptance sections,',
        '    ADR format, and local Markdown links. Exit code is 1 when errors are found.',
      ],
    },
    {
      rows: ['  guarana specs record --stdin'],
      details: ['    Read schema v1 task handoffs or schema v2 known-issue status updates (optionally combined with a task).'],
    },
    {
      rows: ['  guarana specs record --file .specs/state/worker-specs-handoff.json'],
      details: ['    Read/remove the fixed handoff; status-only v2 touches known-issues.md, combined task+issue writes are atomic.'],
    },
    { rows: ['  guarana specs --help                  Show this help'] },
    { rows: ['  guarana specs -h                      Show this help'] },
  ],
};

const WORKFLOW = {
  title: 'guarana workflow — scoped workflow automation preferences',
  sections: [
    {
      rows: ['  guarana workflow read [--project]'],
      details: [
        '    Show the selected scope\'s stored fields and current project-effective values.',
        '    Unset fields inherit from global settings, then default to true.',
      ],
    },
    {
      rows: ['  guarana workflow set <specs|verify> <true|false> [--project]'],
      details: ['    Set one preference in global settings, or in the project with --project.'],
    },
    {
      rows: ['  guarana workflow clear [specs|verify] [--project]'],
      details: [
        '    Clear one preference or all stored preferences in the selected scope.',
        '    Clearing a project preference restores inheritance from global settings.',
      ],
    },
    { rows: ['  guarana workflow --help              Show this help'] },
    { rows: ['  guarana workflow -h                  Show this help'] },
  ],
};

function helpLines(definition) {
  return definition.sections.flatMap(({ rows, details = [] }) => [...rows, ...details]);
}

function usageRows(definition) {
  return definition.sections.flatMap(({ rows }) => rows);
}

const COMMANDS = [
  { name: 'install', handler: 'install', globalUsage: ['  guarana install [--project]     Install the skill suite'] },
  { name: 'uninstall', handler: 'uninstall', globalUsage: ['  guarana uninstall [--project]   Remove the installed suite'] },
  { name: 'list', handler: 'list', globalUsage: ['  guarana list [--project]        Show installed skills, version, and plugin presence'] },
  { name: 'update', handler: 'update', globalUsage: ['  guarana update [--project]      Re-install from the CLI\'s bundled skills'] },
  {
    name: 'plugin',
    handler: 'plugin',
    globalUsage: [
      '  guarana plugin install [--project]    Install plugins, engines, and native profiles',
      '  guarana plugin install --plugins-only [--project]  Install plugins and engines only',
      '  guarana plugin uninstall [--project]  Remove plugins, engines, and native profiles',
      '  guarana plugin uninstall --plugins-only [--project]  Remove only the three plugins',
      '  guarana plugin adopt <plugin-file> --accept-current [--project]  Adopt current bytes for one marked plugin',
      '  guarana plugin status [--project]     Check plugin/engine/vault install health',
    ],
  },
  { name: 'web', handler: 'web', globalUsage: ['  guarana web [--port N] [--open|--no-open]  Start the dashboard with saved or per-run launch settings'] },
  {
    name: 'advisor',
    handler: 'advisor',
    globalUsage: [
      '  guarana advisor models [provider]  List models for providers connected in OpenCode',
      '  guarana advisor read [--project]   Read scoped and effective advisor model settings',
      '  guarana advisor set <field> <id> [--project]  Set a provider/model/variant or advisor.enabled true|false',
      '  guarana advisor clear [field] [--project]  Clear one field or all scoped settings',
      '  guarana advisor status [--project] Check managed command/profile health',
    ],
  },
  {
    name: 'memory',
    handler: 'memory',
    globalUsage: [
      '  guarana memory <sub>            Manage the project memory vault (.guarana/memory/)',
      ...helpLines(MEMORY),
    ],
  },
  { name: 'specs', handler: 'specs', globalUsage: helpLines(SPECS) },
  { name: 'workflow', handler: 'workflow', globalUsage: helpLines(WORKFLOW) },
];

const GLOBAL_FLAGS = [
  '  guarana --help                  Show this help',
  '  guarana --version               Show version',
];

function renderDetailedHelp(definition) {
  return `${definition.title}\n\nUsage:\n${helpLines(definition).join('\n')}\n`;
}

module.exports = {
  COMMANDS,
  MEMORY: { ...MEMORY, helpLines: helpLines(MEMORY), usageRows: usageRows(MEMORY) },
  SPECS: { ...SPECS, helpLines: helpLines(SPECS), usageRows: usageRows(SPECS) },
  WORKFLOW: { ...WORKFLOW, helpLines: helpLines(WORKFLOW), usageRows: usageRows(WORKFLOW) },
  GLOBAL_FLAGS,
  renderDetailedHelp,
};
