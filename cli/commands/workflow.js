'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { WORKFLOW, renderDetailedHelp } = require('../command-metadata.js');
const { stdoutLine, stderrLine, writeStdout } = require('../lib/io.js');
const { parseWorkflowArgs } = require('./workflow-args.js');

const HELP = renderDetailedHelp(WORKFLOW);
const settingsModuleUrl = pathToFileURL(path.join(__dirname, '..', 'orchestrator', 'workflow-settings.js')).href;
let settingsPromise;

function loadSettingsModule() {
  if (!settingsPromise) settingsPromise = import(settingsModuleUrl);
  return settingsPromise;
}

function scopeName(useProject) {
  return useProject ? 'project' : 'global';
}

function settingsOptions() {
  return { directory: process.cwd() };
}

async function run(args, context = {}) {
  const parsed = parseWorkflowArgs(args);
  if (parsed.error) {
    stderrLine(context, `workflow: ${parsed.error}`);
    if (parsed.usage) writeStdout(context, HELP);
    return 1;
  }
  if (parsed.command === 'help') {
    writeStdout(context, HELP);
    return 0;
  }

  try {
    const settings = await loadSettingsModule();
    const scope = scopeName(Boolean(context.useProject));
    const options = settingsOptions();

    if (parsed.command === 'read') {
      const resolved = settings.readWorkflowSettings(options);
      stdoutLine(context, JSON.stringify({
        scope,
        settings: resolved[scope],
        effective: resolved.effective,
        sources: resolved.sources,
      }, null, 2));
      return 0;
    }

    // Validate both scopes before any mutation so malformed settings cannot be
    // silently overwritten by a set or clear-all operation.
    settings.readWorkflowSettings(options);
    if (parsed.command === 'set') {
      settings.setWorkflowPreference(scope, parsed.name, parsed.enabled, options);
      stdoutLine(context, `saved workflow preference ${parsed.name}.enabled=${parsed.enabled} (${scope})`);
      return 0;
    }

    if (parsed.name === undefined) {
      settings.writeWorkflowSettings(scope, {}, options);
      stdoutLine(context, `cleared workflow preferences (${scope})`);
    } else {
      settings.clearWorkflowPreference(scope, parsed.name, options);
      stdoutLine(context, `cleared workflow preference ${parsed.name}.enabled (${scope})`);
    }
    return 0;
  } catch (error) {
    const message = error instanceof SyntaxError ? 'malformed workflow settings JSON' : error.message;
    stderrLine(context, `workflow: ${message}`);
    return 1;
  }
}

module.exports = { run, HELP, parseWorkflowArgs };
