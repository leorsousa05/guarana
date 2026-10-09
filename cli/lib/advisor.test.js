'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const settings = require('./advisor-settings.js');
const profiles = require('./advisor-profiles.js');
const advisorCommand = require('../commands/advisor.js');
const pluginCommand = require('../commands/plugin.js');
const { advisorSettingsTarget, advisorCommandTarget, advisorAgentsTarget, advisorSubagentTarget, legacyAdvisorAgentsTarget } = require('./paths.js');
const { HELP } = require('../help.js');

function isolated(callback) {
  const cwd = process.cwd();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-advisor-home-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-advisor-project-'));
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  try {
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = path.join(home, 'xdg');
    process.chdir(project);
    return callback({ home, project });
  } finally {
    process.chdir(cwd);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
}

test('settings read, set, clear, validate atomically, and merge project fields over global independently', () => {
  isolated(() => {
    settings.setSetting(false, 'primary.provider', 'anthropic');
    settings.setSetting(false, 'primary.model', 'claude-sonnet-4');
    settings.setSetting(false, 'primary.variant', 'high');
    settings.setSetting(false, 'advisor.provider', 'openrouter');
    settings.setSetting(false, 'advisor.model', 'anthropic/claude-opus-4');
    settings.setSetting(false, 'advisor.enabled', true);
    settings.setSetting(true, 'primary.model', 'claude-opus-4');
    settings.setSetting(true, 'advisor.variant', 'max');

    assert.deepEqual(settings.readSettings(false), {
      primary: { provider: 'anthropic', model: 'claude-sonnet-4', variant: 'high' },
      advisor: { provider: 'openrouter', model: 'anthropic/claude-opus-4', enabled: true },
    });
    assert.deepEqual(settings.readSettings(true), { primary: { model: 'claude-opus-4' }, advisor: { variant: 'max' } });
    assert.deepEqual(settings.effectiveSettings(true), {
      primary: { provider: 'anthropic', model: 'claude-opus-4', variant: 'high' },
      advisor: { provider: 'openrouter', model: 'anthropic/claude-opus-4', variant: 'max', enabled: true },
    });
    settings.setSetting(true, 'advisor.enabled', false);
    assert.equal(settings.effectiveSettings(true).advisor.enabled, false);
    settings.clearSettings(true, 'advisor.enabled');
    assert.equal(settings.effectiveSettings(true).advisor.enabled, true);
    assert.equal(advisorSettingsTarget(false), path.join(process.env.XDG_CONFIG_HOME, 'guarana', 'advisor.json'));
    assert.equal(advisorSettingsTarget(true), path.join(process.cwd(), '.guarana', 'advisor.json'));

    const projectFile = advisorSettingsTarget(true);
    const beforeInvalid = fs.readFileSync(projectFile, 'utf8');
    assert.throws(() => settings.setSetting(true, 'advisor.model', 'not a model'), /without whitespace/);
    assert.throws(() => settings.setSetting(true, 'primary.secret', 'credential'), /unknown setting/);
    assert.equal(fs.readFileSync(projectFile, 'utf8'), beforeInvalid);

    settings.clearSettings(true, 'primary.model');
    assert.equal(settings.readSettings(true).primary, undefined);
    assert.equal(settings.effectiveSettings(true).primary.model, 'claude-sonnet-4');
    settings.clearSettings(false);
    assert.deepEqual(settings.readSettings(false), {});
  });
});

test('CLI persists exact OpenRouter tilde model ID into generated advisor profile', () => {
  isolated(() => {
    const id = '~anthropic/claude-fable-latest';
    settings.setSetting(true, 'primary.provider', 'openrouter');
    settings.setSetting(true, 'primary.model', id);
    assert.throws(() => settings.setSetting(true, 'advisor.enabled', true), /requires advisor.provider and advisor.model/);
    settings.setSetting(true, 'advisor.provider', 'openai');
    settings.setSetting(true, 'advisor.model', 'gpt-5');
    settings.setSetting(true, 'advisor.enabled', true);
    assert.equal(settings.readSettings(true).primary.model, id);
    profiles.installAdvisorArtifacts(true);
    assert.match(fs.readFileSync(advisorAgentsTarget(true), 'utf8'), /model: "openrouter\/~anthropic\/claude-fable-latest"/);
    assert.equal(fs.existsSync(advisorSubagentTarget(true)), true);
    assert.throws(() => settings.validateSettings({ primary: { model: 'bad model' } }), /without whitespace/);
    assert.throws(() => settings.validateSettings({ primary: { model: 'bad\u0001model' } }), /without whitespace/);
  });
});

test('generated project/global native command and agents carry configured models, variants, and read-only advisor permissions', () => {
  isolated(({ home }) => {
    for (const scope of [false, true]) {
      for (const [field, value] of Object.entries({
        'primary.provider': 'anthropic',
        'primary.model': scope ? 'claude-sonnet-4' : 'claude-opus-4',
        'primary.variant': 'high',
        'advisor.provider': 'openrouter',
        'advisor.model': 'anthropic/claude-opus-4',
        'advisor.enabled': true,
        'advisor.variant': 'max',
      })) settings.setSetting(scope, field, value);
    }

    const installed = profiles.installAdvisorArtifacts(true);
    assert.equal(installed.installed.length, 3);
    const command = fs.readFileSync(advisorCommandTarget(true), 'utf8');
    const primary = fs.readFileSync(advisorAgentsTarget(true), 'utf8');
    const advisor = fs.readFileSync(advisorSubagentTarget(true), 'utf8');
    assert.match(command, /agent: guarana/);
    assert.match(command, /guarana-managed-advisor-artifact/);
    assert.match(primary, /mode: primary/);
    assert.match(primary, /model: "anthropic\/claude-sonnet-4"/);
    assert.match(primary, /variant: "high"/);
    assert.match(command, /description: .*defaults; OpenCode session selections prevail/);
    assert.match(primary, /description: .*defaults; OpenCode session selections prevail/);
    assert.match(primary, /configured model and variant are agent\/profile defaults only/);
    assert.match(primary, /Explicit or remembered OpenCode session model\/variant selections prevail; do not override them/);
    assert.match(command, /configured Guarana primary profile/i);
    assert.match(primary, /only when you cannot make feasible progress/i);
    assert.match(primary, /relevant tool failures\/retries show that you are blocked/i);
    assert.match(primary, /exact relevant failure\/tool output/i);
    assert.match(primary, /Task description to a brief reason advice is needed now \(3–5 words\), not the overall task title/i);
    assert.match(primary, /For a consultation, send only a concise summary containing the request\/goal, current workflow state and progress, meaningful attempts already made, and the exact relevant failure\/tool output/);
    assert.match(primary, /at most one Task consultation for an unchanged blocking episode/i);
    assert.match(primary, /unavailable, denied, or fails/i);
    assert.match(primary, /continue independently if feasible or ask the user/i);
    assert.match(primary, /Never invent advice or claim a handoff succeeded/i);
    assert.match(primary, /workflow_tick/);
    assert.match(primary, /native Task worker dispatch/);
    assert.match(advisor, /mode: subagent/);
    assert.match(advisor, /model: "openrouter\/anthropic\/claude-opus-4"/);
    assert.match(advisor, /variant: "max"/);
    assert.match(advisor, /edit: deny/);
    assert.match(advisor, /write: deny/);
    assert.match(advisor, /bash: deny/);
    assert.match(advisor, /task: deny/);
    assert.match(advisor, /feasible next steps, relevant tradeoffs\/limitations, and uncertainty/);
    assert.match(advisor, /Do not edit files, run commands, dispatch tasks, advance workflow state/);
    assert.deepEqual(profiles.advisorArtifactStatus(true).map(({ status }) => status), [
      'ok (up to date)', 'ok (up to date)', 'ok (up to date)',
    ]);

    profiles.installAdvisorArtifacts(false);
    const globalOpenCode = path.join(process.env.XDG_CONFIG_HOME, 'opencode');
    assert.ok(fs.existsSync(path.join(globalOpenCode, 'commands', 'guarana-advisor.md')));
    assert.ok(fs.existsSync(path.join(globalOpenCode, 'agents', 'guarana-advisor.md')));
    assert.match(fs.readFileSync(path.join(globalOpenCode, 'agents', 'guarana.md'), 'utf8'), /model: "anthropic\/claude-opus-4"/);
    assert.deepEqual(profiles.advisorArtifactStatus(false).map(({ status }) => status), [
      'ok (up to date)', 'ok (up to date)', 'ok (up to date)',
    ]);
  });
});

test('Primary defaults preserve exact custom model/variant IDs and omit blank variants', () => {
  isolated(() => {
    for (const variant of ['saved-custom', '']) {
      const primary = { provider: 'openrouter', model: '~anthropic/claude-fable-latest', variant };
      const before = structuredClone(primary);
      const generated = profiles.artifacts(true, { settingsOverride: { primary } });
      const profile = generated.find(({ name }) => name === 'primary agent').content;
      assert.match(profile, /^model: "openrouter\/~anthropic\/claude-fable-latest"$/m);
      if (variant) assert.match(profile, /^variant: "saved-custom"$/m);
      else assert.doesNotMatch(profile, /^variant:/m);
      assert.match(profile, /Explicit or remembered OpenCode session model\/variant selections prevail/);
      assert.deepEqual(primary, before);
    }
  });
});

test('foreign files block generation; status detects stale and foreign artifacts; uninstall removes only managed files', () => {
  isolated(() => {
    for (const [field, value] of Object.entries({
      'primary.provider': 'anthropic', 'primary.model': 'claude-sonnet-4',
      'advisor.provider': 'openai', 'advisor.model': 'gpt-5',
      'advisor.enabled': true,
    })) settings.setSetting(true, field, value);

    const commandPath = advisorCommandTarget(true);
    fs.mkdirSync(path.dirname(commandPath), { recursive: true });
    fs.writeFileSync(commandPath, 'owned by another tool\n');
    assert.throws(() => profiles.installAdvisorArtifacts(true), /not managed by Guarana/);
    assert.equal(fs.readFileSync(commandPath, 'utf8'), 'owned by another tool\n');
    assert.equal(fs.existsSync(advisorAgentsTarget(true)), false);

    fs.unlinkSync(commandPath);
    profiles.installAdvisorArtifacts(true);
    const agentPath = advisorAgentsTarget(true);
    fs.appendFileSync(agentPath, '\nmanual edit\n');
    assert.equal(profiles.advisorArtifactStatus(true)[1].status, 'stale (managed by Guarana)');
    fs.writeFileSync(agentPath, 'foreign replacement\n');
    assert.equal(profiles.advisorArtifactStatus(true)[1].status, 'foreign');

    fs.writeFileSync(advisorSettingsTarget(true), '{ invalid settings');
    const result = profiles.uninstallAdvisorArtifacts(true);
    assert.equal(result.removed.length, 2);
    assert.deepEqual(result.preserved, [agentPath]);
    assert.equal(fs.readFileSync(agentPath, 'utf8'), 'foreign replacement\n');
    assert.equal(fs.existsSync(commandPath), false);
    assert.equal(fs.existsSync(advisorSubagentTarget(true)), false);
  });
});

test('missing Primary settings install an actionable setup-only command without binding or processing task arguments', () => {
  isolated(() => {
    const result = profiles.installAdvisorArtifacts(true);
    assert.equal(result.setupOnly, true);
    assert.equal(result.installed.length, 1);
    const command = fs.readFileSync(advisorCommandTarget(true), 'utf8');
    assert.doesNotMatch(command, /^agent:/m);
    assert.doesNotMatch(command, /\$ARGUMENTS/);
    assert.match(command, /setup-only command/i);
    assert.match(command, /Do not inspect, analyze, plan, execute, edit, delegate, or claim completion/i);
    for (const field of ['primary.provider', 'primary.model']) {
      assert.match(command, new RegExp(`guarana advisor set ${field.replace('.', '\\.')} <(?:provider|model)-id>`));
    }
    assert.match(command, /opencode models/);
    assert.equal(fs.existsSync(advisorAgentsTarget(true)), false);
    assert.equal(fs.existsSync(advisorSubagentTarget(true)), false);
    assert.deepEqual(profiles.advisorArtifactStatus(true).map(({ status }) => status), [
      'ok (up to date)', 'settings incomplete', 'settings incomplete',
    ]);
  });
});

test('Primary-only settings generate the guarana primary profile but no Advisor agent', () => {
  isolated(() => {
    settings.setSetting(true, 'primary.provider', 'anthropic');
    settings.setSetting(true, 'primary.model', 'claude-sonnet-4');
    const result = profiles.installAdvisorArtifacts(true);
    assert.equal(result.setupOnly, false);
    assert.equal(result.installed.length, 2);
    assert.match(fs.readFileSync(advisorCommandTarget(true), 'utf8'), /agent: guarana/);
    assert.match(fs.readFileSync(advisorAgentsTarget(true), 'utf8'), /mode: primary/);
    assert.equal(fs.existsSync(advisorSubagentTarget(true)), false);
    assert.deepEqual(profiles.advisorArtifactStatus(true).map(({ status }) => status), [
      'ok (up to date)', 'ok (up to date)', 'not installed',
    ]);
  });
});

test('disabling Advisor removes its managed profile and retains the Guarana primary', () => {
  isolated(() => {
    for (const [field, value] of Object.entries({
      'primary.provider': 'anthropic', 'primary.model': 'claude-sonnet-4',
      'advisor.provider': 'openai', 'advisor.model': 'gpt-5', 'advisor.enabled': true,
    })) settings.setSetting(true, field, value);
    profiles.installAdvisorArtifacts(true);
    settings.setSetting(true, 'advisor.enabled', false);
    profiles.installAdvisorArtifacts(true);
    assert.equal(fs.existsSync(advisorAgentsTarget(true)), true);
    assert.equal(fs.existsSync(advisorSubagentTarget(true)), false);
    assert.match(fs.readFileSync(advisorCommandTarget(true), 'utf8'), /agent: guarana/);
    assert.deepEqual(profiles.advisorArtifactStatus(true).map(({ status }) => status), [
      'ok (up to date)', 'ok (up to date)', 'not installed',
    ]);
  });
});

test('migration removes only marked legacy profiles and preserves foreign old and current names', () => {
  isolated(() => {
    settings.setSetting(true, 'primary.provider', 'anthropic');
    settings.setSetting(true, 'primary.model', 'claude-sonnet-4');
    const legacy = legacyAdvisorAgentsTarget(true);
    fs.mkdirSync(path.dirname(legacy), { recursive: true });
    fs.writeFileSync(legacy, `${profiles.ADVISOR_MARKER || '<!-- guarana-managed-advisor-artifact -->'}\nlegacy`);
    profiles.installAdvisorArtifacts(true);
    assert.equal(fs.existsSync(legacy), false);

    fs.writeFileSync(legacy, 'foreign legacy agent');
    fs.writeFileSync(advisorSubagentTarget(true), 'foreign current agent');
    profiles.installAdvisorArtifacts(true);
    assert.equal(fs.readFileSync(legacy, 'utf8'), 'foreign legacy agent');
    assert.equal(fs.readFileSync(advisorSubagentTarget(true), 'utf8'), 'foreign current agent');
  });
});

test('setup-only command coexists with foreign agent files while completion preflights settings safely', () => {
  isolated(() => {
    const foreignAgent = advisorAgentsTarget(true);
    fs.mkdirSync(path.dirname(foreignAgent), { recursive: true });
    fs.writeFileSync(foreignAgent, 'foreign agent profile\n');
    const originalLog = console.log;
    const originalError = console.error;
    const originalExitCode = process.exitCode;
    console.log = () => {};
    console.error = () => {};
    try {
      advisorCommand.run(['set', 'primary.provider', 'anthropic'], { useProject: true });
      advisorCommand.run(['set', 'primary.model', 'claude-sonnet-4'], { useProject: true });
      advisorCommand.run(['set', 'advisor.provider', 'openai'], { useProject: true });
      assert.match(fs.readFileSync(advisorCommandTarget(true), 'utf8'), /setup-only command/i);
      assert.equal(fs.readFileSync(foreignAgent, 'utf8'), 'foreign agent profile\n');

      advisorCommand.run(['set', 'advisor.model', 'gpt-5'], { useProject: true });
      assert.deepEqual(settings.readSettings(true).advisor, { provider: 'openai', model: 'gpt-5' });
      assert.equal(fs.readFileSync(foreignAgent, 'utf8'), 'foreign agent profile\n');
      assert.match(fs.readFileSync(advisorCommandTarget(true), 'utf8'), /setup-only command/i);
      assert.equal(process.exitCode, 1);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      process.exitCode = originalExitCode;
    }
  });
});

test('CLI help exposes advisor configuration and status commands', () => {
  assert.match(HELP, /guarana advisor models \[provider\]/);
  assert.match(HELP, /guarana advisor read/);
  assert.match(HELP, /guarana advisor set <field> <id>/);
  assert.match(HELP, /primary\.variant/);
  assert.match(HELP, /advisor\.variant/);
  assert.match(HELP, /Agent\/profile defaults only; explicit or remembered OpenCode\s+session model\/variant selections prevail/);
});

test('CLI advisor models lists metadata and reports safe discovery errors', async () => {
  const modelCatalog = require('./opencode-model-catalog.js');
  const originalDiscover = modelCatalog.discoverModels;
  const output = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalExitCode = process.exitCode;
  modelCatalog.discoverModels = async ({ cwd, provider }) => {
    assert.equal(cwd, process.cwd());
    assert.equal(provider, 'openai');
    return {
      models: [{ provider: { id: 'openai', name: 'openai' }, model: { id: 'gpt-5', name: 'gpt-5' } }],
      error: null,
    };
  };
  console.log = (...parts) => output.push(parts.join(' '));
  console.error = (...parts) => errors.push(parts.join(' '));
  try {
    await advisorCommand.run(['models', 'openai'], { useProject: true });
    assert.deepEqual(JSON.parse(output[0]), [
      { provider: { id: 'openai', name: 'openai' }, model: { id: 'gpt-5', name: 'gpt-5' } },
    ]);

    modelCatalog.discoverModels = async () => ({ models: [], error: 'OpenCode is not installed.' });
    await advisorCommand.run(['models'], { useProject: true });
    assert.deepEqual(JSON.parse(output[1]), []);
    assert.match(errors[0], /not installed/);
    assert.equal(process.exitCode, 1);
  } finally {
    modelCatalog.discoverModels = originalDiscover;
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = originalExitCode;
  }
});

test('CLI advisor read/set/clear commands operate on their selected settings scope', () => {
  isolated(() => {
    const lines = [];
    const originalLog = console.log;
    console.log = (...parts) => lines.push(parts.join(' '));
    try {
      advisorCommand.run(['set', 'primary.provider', 'anthropic'], { useProject: false });
      advisorCommand.run(['set', 'primary.model', 'claude-sonnet-4'], { useProject: true });
      advisorCommand.run(['set', 'advisor.enabled', 'false'], { useProject: true });
      advisorCommand.run(['read'], { useProject: false });
      advisorCommand.run(['read'], { useProject: true });
      const documents = lines.filter((line) => line.startsWith('{')).map((line) => JSON.parse(line));
      assert.deepEqual(documents[0].settings, { primary: { provider: 'anthropic' } });
      assert.deepEqual(documents[1].settings, { primary: { model: 'claude-sonnet-4' }, advisor: { enabled: false } });
      assert.deepEqual(documents[1].effective, { primary: { provider: 'anthropic', model: 'claude-sonnet-4' }, advisor: { enabled: false } });
      advisorCommand.run(['clear', 'primary.model'], { useProject: true });
      advisorCommand.run(['clear', 'advisor.enabled'], { useProject: true });
      advisorCommand.run(['clear', 'primary.provider'], { useProject: false });
      assert.deepEqual(settings.readSettings(true), {});
      assert.deepEqual(settings.readSettings(false), {});
    } finally {
      console.log = originalLog;
    }
  });
});

test('CLI advisor set/clear refreshes the selected scope artifacts and preflights foreign ownership', () => {
  isolated(({ home }) => {
    const lines = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalExitCode = process.exitCode;
    console.log = (...parts) => lines.push(parts.join(' '));
    console.error = (...parts) => lines.push(parts.join(' '));
    try {
      advisorCommand.run(['set', 'primary.provider', 'anthropic'], { useProject: true });
      advisorCommand.run(['set', 'primary.model', 'claude-opus-4'], { useProject: true });
      advisorCommand.run(['set', 'advisor.provider', 'openai'], { useProject: true });
      advisorCommand.run(['set', 'advisor.model', 'gpt-5'], { useProject: true });
      advisorCommand.run(['set', 'advisor.enabled', 'true'], { useProject: true });
      advisorCommand.run(['set', 'primary.variant', 'high'], { useProject: true });
      advisorCommand.run(['set', 'advisor.variant', 'max'], { useProject: true });
      const command = fs.readFileSync(advisorCommandTarget(true), 'utf8');
      const primary = fs.readFileSync(advisorAgentsTarget(true), 'utf8');
      const advisor = fs.readFileSync(advisorSubagentTarget(true), 'utf8');
      assert.match(command, /agent: guarana/);
      assert.match(primary, /model: "anthropic\/claude-opus-4"/);
      assert.match(primary, /variant: "high"/);
      assert.match(advisor, /model: "openai\/gpt-5"/);
      assert.match(advisor, /variant: "max"/);

      advisorCommand.run(['set', 'primary.model', 'claude-haiku-4'], { useProject: true });
      assert.match(fs.readFileSync(advisorAgentsTarget(true), 'utf8'), /model: "anthropic\/claude-haiku-4"/);
      advisorCommand.run(['clear'], { useProject: true });
      assert.ok(fs.existsSync(advisorCommandTarget(true)));
      assert.match(fs.readFileSync(advisorCommandTarget(true), 'utf8'), /setup-only command/i);
      assert.equal(fs.existsSync(advisorAgentsTarget(true)), false);
      assert.equal(fs.existsSync(advisorSubagentTarget(true)), false);

      advisorCommand.run(['set', 'primary.provider', 'openai'], { useProject: false });
      advisorCommand.run(['set', 'primary.model', 'gpt-5'], { useProject: false });
      advisorCommand.run(['set', 'advisor.provider', 'anthropic'], { useProject: false });
      advisorCommand.run(['set', 'advisor.model', 'claude-opus-4'], { useProject: false });
      advisorCommand.run(['set', 'advisor.enabled', 'true'], { useProject: false });
      assert.match(fs.readFileSync(advisorAgentsTarget(false), 'utf8'), /model: "openai\/gpt-5"/);
      assert.match(fs.readFileSync(advisorSubagentTarget(false), 'utf8'), /model: "anthropic\/claude-opus-4"/);
      assert.equal(fs.existsSync(path.join(process.env.XDG_CONFIG_HOME, 'opencode', 'commands', 'guarana-advisor.md')), true);
      advisorCommand.run(['set', 'advisor.variant', 'max'], { useProject: false });
      assert.match(fs.readFileSync(advisorSubagentTarget(false), 'utf8'), /variant: "max"/);
      advisorCommand.run(['clear'], { useProject: false });
      assert.ok(fs.existsSync(advisorCommandTarget(false)));
      assert.match(fs.readFileSync(advisorCommandTarget(false), 'utf8'), /setup-only command/i);
      assert.equal(fs.existsSync(advisorAgentsTarget(false)), false);
      assert.equal(fs.existsSync(advisorSubagentTarget(false)), false);

      const foreign = advisorCommandTarget(true);
      fs.mkdirSync(path.dirname(foreign), { recursive: true });
      fs.writeFileSync(foreign, 'foreign command');
      advisorCommand.run(['set', 'primary.model', 'claude-sonnet-4'], { useProject: true });
      assert.equal(settings.readSettings(true).primary, undefined);
      assert.equal(fs.readFileSync(foreign, 'utf8'), 'foreign command');
      assert.ok(lines.some((line) => line.includes('not managed by Guarana')));
    } finally {
      console.log = originalLog;
      console.error = originalError;
      process.exitCode = originalExitCode;
    }
  });
});

test('plugin install/status/uninstall includes configured advisor artifacts', async () => {
  const cwd = process.cwd();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-advisor-plugin-home-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-advisor-plugin-project-'));
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  process.env.HOME = home;
  process.env.XDG_CONFIG_HOME = path.join(home, 'xdg');
  process.chdir(project);
  try {
    for (const [field, value] of Object.entries({
      'primary.provider': 'anthropic', 'primary.model': 'claude-sonnet-4',
      'advisor.provider': 'openai', 'advisor.model': 'gpt-5',
      'advisor.enabled': true,
    })) settings.setSetting(true, field, value);
    const lines = [];
    const originalLog = console.log;
    console.log = (...parts) => lines.push(parts.join(' '));
    try {
      pluginCommand.install(true, { quiet: true });
      assert.ok(fs.existsSync(advisorCommandTarget(true)));
      await pluginCommand.run(['status'], { useProject: true });
      assert.ok(lines.some((line) => line.includes('advisor command') && line.includes('ok (up to date)')));
      pluginCommand.uninstall(true);
      assert.equal(fs.existsSync(advisorCommandTarget(true)), false);
      assert.equal(fs.existsSync(advisorAgentsTarget(true)), false);
    } finally {
      console.log = originalLog;
    }
  } finally {
    process.chdir(cwd);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('plugin install/status keeps the setup-only advisor command available without complete settings', async () => {
  const cwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-advisor-setup-project-'));
  process.chdir(project);
  try {
    pluginCommand.install(true, { quiet: true });
    assert.ok(fs.existsSync(advisorCommandTarget(true)));
    assert.equal(fs.existsSync(advisorAgentsTarget(true)), false);
    const lines = [];
    const originalLog = console.log;
    console.log = (...parts) => lines.push(parts.join(' '));
    try {
      await pluginCommand.run(['status'], { useProject: true });
    } finally {
      console.log = originalLog;
    }
    assert.ok(lines.some((line) => line.includes('advisor command') && line.includes('ok (up to date)')));
    assert.ok(lines.some((line) => line.includes('advisor primary agent') && line.includes('settings incomplete')));
  } finally {
    process.chdir(cwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});
