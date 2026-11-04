import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const enabled = process.env.GUARANA_E2E_OPENAI === '1';
const model = process.env.GUARANA_E2E_MODEL || 'openai/gpt-6-luna';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cliPath = path.join(repoRoot, 'bin', 'guarana.js');
const opencode = process.env.OPENCODE_BIN || 'opencode';
const timeoutMs = Number(process.env.GUARANA_E2E_TIMEOUT_MS || 300_000);
const maxOutputBytes = 4 * 1024 * 1024;

test('provider E2E never auto-approves OpenCode permissions', () => {
  const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const start = source.lastIndexOf('  const runArgs = [');
  const promptPush = source.indexOf('runArgs.push(prompt);', start);
  const runArgsBlock = start >= 0 && promptPush >= 0
    ? source.slice(start, promptPush + 'runArgs.push(prompt);'.length)
    : '';
  assert.ok(runArgsBlock, 'provider E2E command arguments should be explicit');
  assert.doesNotMatch(runArgsBlock, /--auto/);
});

test('provider E2E uses isolated home and data directories', () => {
  const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const start = source.lastIndexOf('  const env = {');
  const end = source.indexOf('\n  };', start);
  const envBlock = start >= 0 && end >= 0 ? source.slice(start, end) : '';
  assert.ok(envBlock, 'provider E2E child environment should be explicit');
  assert.ok(envBlock.includes('HOME: isolatedHome'));
  assert.ok(envBlock.includes('XDG_CONFIG_HOME: isolatedConfigHome'));
  assert.ok(envBlock.includes('XDG_DATA_HOME: isolatedDataHome'));
  assert.ok(envBlock.includes('PWD: projectRoot'));
  assert.equal(envBlock.includes('...process.env'), false);
});

function run(command, args, { cwd, env, timeout = timeoutMs, stdin = 'ignore' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: [stdin, 'pipe', 'pipe'],
      windowsHide: true,
    });
    const chunks = { stdout: [], stderr: [] };
    let outputBytes = 0;
    let timedOut = false;
    let overflow = false;
    let killTimer;

    const stop = () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 3_000);
      killTimer.unref?.();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeout);
    timer.unref?.();

    for (const stream of ['stdout', 'stderr']) {
      child[stream].on('data', (chunk) => {
        outputBytes += chunk.length;
        if (outputBytes <= maxOutputBytes) chunks[stream].push(chunk);
        else if (!overflow) {
          overflow = true;
          stop();
        }
      });
    }

    child.once('error', (error) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      reject(new Error(`Unable to start ${path.basename(command)} (${error.code || 'spawn error'}).`));
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve({
        code,
        signal,
        timedOut,
        overflow,
        outputBytes,
        stdout: Buffer.concat(chunks.stdout).toString('utf8'),
        stderr: Buffer.concat(chunks.stderr).toString('utf8'),
      });
    });
  });
}

function parseJsonLines(text) {
  return text.split(/\r?\n/).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function safeEventSummary(events) {
  return JSON.stringify(events.slice(-16).map((event) => {
    const item = { type: event?.type };
    const part = event?.part || {};
    if (event?.type === 'tool_use') {
      item.tool = typeof part.tool === 'string' ? part.tool : undefined;
      item.status = part.state?.status;
    }
    if (event?.type === 'text') item.textChars = typeof event.text === 'string' ? event.text.length : 0;
    if (event?.type === 'error') item.error = safeError(event);
    return item;
  }));
}

function safeError(event) {
  const error = event?.error || {};
  const data = error.data || {};
  const text = [error.name, error.type, error.code, error.message, data.message, data.ref]
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(': ');
  return text
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .replace(/(Bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    .slice(0, 400);
}

function safeLogs(text) {
  return text.split(/\r?\n/)
    .filter((line) => /error|failed|exception|plugin|server/i.test(line))
    .slice(-8)
    .join('\n')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .replace(/(Bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret|authorization)["']?\s*[:=]\s*["']?)[^\s,"']+/gi, '$1[REDACTED]')
    .slice(-600);
}

test('real OpenCode run completes Guarana workflow in an isolated project', {
  skip: enabled ? false : 'set GUARANA_E2E_OPENAI=1 and GUARANA_E2E_XDG_DATA_HOME to a dedicated auth profile for a live OpenAI call',
}, async (t) => {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  assert.ok(nodeMajor >= 22, `Guarana requires Node 22+; current runtime is ${process.versions.node}`);
  assert.match(model, /^openai\/[A-Za-z0-9._+-]+$/, 'GUARANA_E2E_MODEL must name an OpenAI model');
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0, 'GUARANA_E2E_TIMEOUT_MS must be positive');
  assert.notEqual(process.env.GUARANA_E2E_AUTO, '1',
    'Automatic permission approval is disabled; approve OpenCode tool requests interactively.');

  const configuredDataHome = process.env.GUARANA_E2E_XDG_DATA_HOME;
  assert.ok(typeof configuredDataHome === 'string' && path.isAbsolute(configuredDataHome),
    'Set GUARANA_E2E_XDG_DATA_HOME to a dedicated absolute OpenCode data directory with E2E auth.');
  assert.ok(fs.existsSync(configuredDataHome) && fs.statSync(configuredDataHome).isDirectory(),
    'GUARANA_E2E_XDG_DATA_HOME must be an existing directory.');
  const isolatedDataHome = fs.realpathSync(configuredDataHome);
  const activeDataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  const activeDataPath = fs.existsSync(activeDataHome) ? fs.realpathSync(activeDataHome) : path.resolve(activeDataHome);
  const overlaps = (a, b) => a === b || a.startsWith(`${b}${path.sep}`) || b.startsWith(`${a}${path.sep}`);
  assert.equal(overlaps(isolatedDataHome, activeDataPath), false,
    'GUARANA_E2E_XDG_DATA_HOME must not reuse or nest inside the active OpenCode data directory.');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-opencode-e2e-'));
  const projectRoot = path.join(tempRoot, 'project');
  const isolatedHome = path.join(tempRoot, 'home');
  const isolatedConfigHome = path.join(tempRoot, 'xdg-config');
  const isolatedTmp = path.join(tempRoot, 'tmp');
  fs.mkdirSync(isolatedHome, { recursive: true });
  fs.mkdirSync(isolatedConfigHome, { recursive: true });
  fs.mkdirSync(isolatedTmp, { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'test'), { recursive: true });
  t.after(() => {
    if (process.env.GUARANA_E2E_KEEP_PROJECT === '1') {
      console.log(`Kept isolated e2e project at ${projectRoot}`);
      return;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  fs.writeFileSync(path.join(projectRoot, 'src', 'math.mjs'), [
    'export function add(a, b) {',
    '  return a + b;',
    '}',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(projectRoot, 'test', 'math.test.mjs'), [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { add, subtract } from '../src/math.mjs';",
    '',
    "test('add returns the sum', () => assert.equal(add(2, 3), 5));",
    "test('subtract returns the difference', () => assert.equal(subtract(9, 4), 5));",
    '',
  ].join('\n'));

  const fixtureTestBaseline = fs.readFileSync(path.join(projectRoot, 'test', 'math.test.mjs'), 'utf8');
  const [provider, modelId] = model.split('/');
  const projectAdvisorSettings = path.join(projectRoot, '.guarana', 'advisor.json');
  fs.mkdirSync(path.dirname(projectAdvisorSettings), { recursive: true });
  fs.writeFileSync(projectAdvisorSettings, `${JSON.stringify({
    primary: { provider, model: modelId },
    advisor: { enabled: false },
  }, null, 2)}\n`);
  const pathEntries = [
    path.dirname(process.execPath),
    ...(path.isAbsolute(opencode) ? [path.dirname(opencode)] : []),
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
  ].filter((entry, index, entries) => fs.existsSync(entry) && entries.indexOf(entry) === index);
  // Keep only the dedicated E2E auth profile and temporary project paths;
  // never inherit the user's HOME, active data store, or ambient credentials.
  const env = {
    PATH: pathEntries.join(path.delimiter),
    HOME: isolatedHome,
    PWD: projectRoot,
    TMPDIR: isolatedTmp,
    XDG_CONFIG_HOME: isolatedConfigHome,
    XDG_DATA_HOME: isolatedDataHome,
  };

  const versionCheck = await run(opencode, ['--version'], { cwd: projectRoot, env });
  assert.equal(versionCheck.code, 0, `Unable to run OpenCode (${versionCheck.code ?? versionCheck.signal}).`);
  const openCodeVersion = versionCheck.stdout.trim();
  assert.match(openCodeVersion, /\bv?2\./,
    `E2E requires OpenCode v2+ for isolated server mode; found ${openCodeVersion || 'unknown'} (set OPENCODE_BIN to the active v2 binary).`);

  const authCheck = await run(opencode, ['auth', 'list'], { cwd: projectRoot, env });
  assert.equal(authCheck.code, 0, 'Unable to inspect OpenCode v2 provider status.');
  assert.match(authCheck.stdout, /OpenAI\s+OAuth\s+stored/i,
    'The dedicated E2E data home must contain OpenAI OAuth auth; the active user profile is not used.');

  const baseline = await run(process.execPath, ['--test', 'test/math.test.mjs'], {
    cwd: projectRoot,
    env,
  });
  assert.notEqual(baseline.code, 0,
    `fixture must start with a failing subtraction test (child exit ${baseline.code}; ${baseline.stdout.slice(-300)}${baseline.stderr.slice(-300)})`);

  const install = await run(process.execPath, [cliPath, 'install', '--project'], {
    cwd: projectRoot,
    env,
  });
  assert.equal(install.code, 0, `Guarana project install failed (exit ${install.code ?? install.signal}).`);
  assert.ok(fs.existsSync(path.join(projectRoot, '.opencode', 'plugins', 'guarana-orchestrator.js')),
    'project-scoped Guarana orchestrator plugin was not installed');
  assert.ok(fs.existsSync(path.join(projectRoot, '.opencode', 'agents', 'guarana.md')),
    'project-scoped Guarana primary profile was not installed from the fixture settings');

  const prompt = [
    'Complete this small coding task in the current project using the installed Guarana workflow.',
    'Implement and export subtract(a, b) in src/math.mjs without changing add.',
    'Run node --test test/math.test.mjs and keep fixing until it passes.',
    'Do not modify files outside src/math.mjs. Do not use network, git, or package managers.',
    'Do not skip independent verification and do not create human-readable project specs or trackers.',
  ].join(' ');
  const runArgs = [
    'run', '--standalone', '--print-logs', '--log-level', 'debug', '--agent', 'guarana', '--model', model, '--format', 'json',
    '--title', 'Guarana scratch end-to-end workflow test',
  ];
  runArgs.push(prompt);

  const execution = await run(opencode, runArgs, { cwd: projectRoot, env, stdin: 'inherit' });
  const events = parseJsonLines(execution.stdout);
  const errorEvent = events.find((event) => event.type === 'error');
  const debugLogs = safeLogs(execution.stderr);
  assert.equal(execution.timedOut, false, 'OpenCode workflow timed out');
  assert.equal(execution.overflow, false, 'OpenCode output exceeded the test limit');
  assert.equal(execution.code, 0,
    `OpenCode workflow exited ${execution.code ?? execution.signal}${errorEvent ? `: ${safeError(errorEvent) || 'error event'}` : ''}${debugLogs ? `; ${debugLogs}` : ''}.`);

  const source = fs.readFileSync(path.join(projectRoot, 'src', 'math.mjs'), 'utf8');
  assert.match(source, /export\s+function\s+subtract\s*\(/,
    `OpenCode did not implement the requested export; events=${safeEventSummary(events)}`);
  const testSource = fs.readFileSync(path.join(projectRoot, 'test', 'math.test.mjs'), 'utf8');
  assert.equal(testSource, fixtureTestBaseline, 'OpenCode changed the acceptance test instead of implementing the source');

  const verification = await run(process.execPath, ['--test', 'test/math.test.mjs'], {
    cwd: projectRoot,
    env,
  });
  assert.equal(verification.code, 0, `Scratch acceptance tests failed (exit ${verification.code ?? verification.signal}).`);

  const workflowPath = path.join(projectRoot, '.specs', 'state', 'workflow.json');
  assert.ok(fs.existsSync(workflowPath), 'Guarana did not persist operational workflow state');
  const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  const historyEvents = workflow.history.map((entry) => entry.event);
  assert.equal(workflow.state, 'completed', 'Guarana workflow did not reach completed');
  for (const event of ['new_task', 'plan_complete', 'run_start', 'code_complete', 'verify_pass']) {
    assert.ok(historyEvents.includes(event), `workflow history is missing ${event}`);
  }
  assert.equal(fs.existsSync(path.join(projectRoot, '.specs', 'README.md')), false,
    'a simple task unexpectedly scaffolded a human-readable specs tracker');

  assert.ok(events.some((event) => event.type === 'text'), 'OpenCode returned no assistant text event');
});
