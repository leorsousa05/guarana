#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-pack-smoke-'));
const packDirectory = path.join(sandbox, 'pack');
const installPrefix = path.join(sandbox, 'global');
const home = path.join(sandbox, 'home');
const project = path.join(sandbox, 'project');
for (const directory of [packDirectory, home, project]) fs.mkdirSync(directory, { recursive: true });

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function smokeDashboard(binary, cwd, env) {
  const port = await availablePort();
  const child = spawn(binary, ['web', '--no-open', '--port', String(port)], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  let stdout = '';
  let stderr = '';
  let startError;
  child.stdout.setEncoding('utf8').on('data', (text) => { stdout += text; });
  child.stderr.setEncoding('utf8').on('data', (text) => { stderr += text; });
  child.once('error', (error) => { startError = error; });
  const closed = new Promise((resolve) => child.once('close', (code, signal) => resolve({ code, signal })));

  try {
    const deadline = Date.now() + 30000;
    let response;
    while (Date.now() < deadline) {
      if (startError) throw startError;
      if (child.exitCode !== null) {
        throw new Error(`guarana web exited before listening\n${stdout}\n${stderr}`);
      }
      try {
        response = await fetch(`http://127.0.0.1:${port}/api/workflow/current`);
        if (response.ok) break;
      } catch {
        // The server may still be installing its locked production dependency.
      }
      await delay(150);
    }
    assert.ok(response?.ok, `packed dashboard did not answer on port ${port}\n${stdout}\n${stderr}`);
    const workflow = await response.json();
    assert.equal(workflow.state, 'idle');
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    const exited = await Promise.race([closed.then(() => true), delay(5000).then(() => false)]);
    if (!exited) {
      child.kill('SIGKILL');
      await closed;
      throw new Error('guarana web did not stop after SIGTERM');
    }
  }
}

try {
  const packed = JSON.parse(run(npm, ['pack', '--pack-destination', packDirectory, '--json'], root))[0];
  assert.ok(packed, 'npm pack should describe the generated archive');
  assert.equal(
    packed.files.some(({ path: file }) => /(^|\/)node_modules(\/|$)/.test(file)),
    false,
    'the npm archive must not contain environment-local node_modules',
  );
  for (const requiredFile of ['LICENSE', 'CHANGELOG.md', 'RELEASING.md']) {
    assert.ok(packed.files.some(({ path: file }) => file === requiredFile), `${requiredFile} must ship in npm`);
  }

  const archive = path.join(packDirectory, packed.filename);
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_DATA_HOME: path.join(home, '.local', 'share'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
  };
  run(npm, ['install', '--global', '--prefix', installPrefix, archive, '--no-audit', '--no-fund'], project, env);

  const binary = path.join(installPrefix, 'bin', process.platform === 'win32' ? 'guarana.cmd' : 'guarana');
  const version = run(binary, ['--version'], project, env).trim();
  assert.equal(version, JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version);

  run(binary, ['install', '--project'], project, env);
  assert.ok(fs.existsSync(path.join(project, '.opencode', 'skills', 'guarana', 'SKILL.md')));
  const listing = run(binary, ['list', '--project'], project, env);
  assert.match(listing, /guarana:plan/);

  const pluginStatus = run(binary, ['plugin', 'status', '--project'], project, env);
  assert.match(pluginStatus, /guarana-orchestrator\.js: ok/);
  assert.match(pluginStatus, /engine health: ok/);
  await smokeDashboard(binary, project, env);

  if (process.env.GUARANA_OPENCODE_SMOKE === '1') {
    const hostVersion = run('opencode', ['--version'], project, env).trim();
    const resolvedConfig = run('opencode', ['debug', 'config'], project, env);
    for (const plugin of ['guarana-telemetry', 'guarana-memory', 'guarana-orchestrator']) {
      assert.ok(resolvedConfig.includes(plugin), `OpenCode ${hostVersion} must resolve ${plugin}`);
    }
    const discoveredSkills = run('opencode', ['debug', 'skill'], project, env);
    assert.ok(discoveredSkills.includes('guarana:plan'), `OpenCode ${hostVersion} must discover guarana:plan`);
    console.log(`OpenCode host smoke passed: ${hostVersion}.`);
  }

  run(binary, ['uninstall', '--project'], project, env);
  assert.equal(fs.existsSync(path.join(project, '.opencode', 'skills', 'guarana')), false);
  assert.equal(fs.existsSync(path.join(project, '.opencode', 'plugins', 'guarana-orchestrator.js')), false);

  console.log(`Packed CLI smoke passed: ${packed.filename} (${packed.files.length} files, no node_modules).`);
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
