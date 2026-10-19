const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MAIN = path.join(__dirname, 'main.js');
const BIN = path.join(__dirname, '..', 'bin', 'guarana.js');
const VERSION = require('../package.json').version;
const REGISTRY = require('./commands/registry.js');
const { main } = require('./main.js');
const { COMMANDS, MEMORY, SPECS, WORKFLOW } = require('./command-metadata.js');
const { stderrLine } = require('./lib/io.js');

const CHILD_BOOTSTRAP = String.raw`
const Module = require('node:module');
const path = require('node:path');
const mainPath = process.argv[1];
const registryPath = path.join(path.dirname(mainPath), 'commands', 'registry.js');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent && parent.filename === registryPath && request.startsWith('./')) {
    const commandRequest = './commands/' + request.slice(2);
    return {
      run(args, options) {
        process.stdout.write(JSON.stringify({ request: commandRequest, args, options: { useProject: options.useProject } }) + '\n');
        return 0;
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
(async () => {
  const exitCode = await require(mainPath).main(process.argv.slice(2));
  process.exitCode = exitCode;
})().catch((error) => {
  process.stderr.write(String(error && error.message ? error.message : error) + '\n');
  process.exitCode = 1;
});
`;

function runMain(args) {
  return spawnSync(process.execPath, ['-e', CHILD_BOOTSTRAP, MAIN, ...args], {
    encoding: 'utf8',
  });
}

function runBin(args, options = {}) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', ...options });
}

function assertHelpResult(args) {
  const result = runMain(args);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /guarana --help/);
}

function assertHandlerCall(args, expected) {
  const result = runMain(args);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), expected);
}

function createStreams({ stdoutTTY = false, stderrTTY = false } = {}) {
  let stdout = '';
  let stderr = '';
  return {
    stdout: { isTTY: stdoutTTY, write: (chunk) => { stdout += chunk.toString(); } },
    stderr: { isTTY: stderrTTY, write: (chunk) => { stderr += chunk.toString(); } },
    output: () => ({ stdout, stderr }),
  };
}

async function withEnv(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function withInstallHandler(run, callback) {
  const original = REGISTRY.install;
  REGISTRY.install = { run };
  try {
    return await callback();
  } finally {
    REGISTRY.install = original;
  }
}

describe('cli/main dispatch characterization', () => {
  it('prints help and exits 0 with no args or either help flag', () => {
    for (const args of [[], ['--help'], ['-h']]) assertHelpResult(args);
  });

  it('prints the version and exits 0 with either version flag', () => {
    for (const flag of ['--version', '-v']) {
      const result = runMain([flag]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, `${VERSION}\n`);
    }
  });

  it('reports an unknown command, prints help, and exits 1', () => {
    const result = runMain(['not-a-command']);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'unknown command: not-a-command');
    assert.match(result.stdout, /Usage:/);
  });

  it('passes remaining command args and globally strips --project at any position for other commands', () => {
    assertHandlerCall(
      ['--project', 'install', 'before', '--project', 'after'],
      { request: './commands/install.js', args: ['before', 'after'], options: { useProject: true } }
    );
    assertHandlerCall(
      ['install', 'before', '--project', 'after'],
      { request: './commands/install.js', args: ['before', 'after'], options: { useProject: true } }
    );
    assertHandlerCall(
      ['install', 'plain'],
      { request: './commands/install.js', args: ['plain'], options: { useProject: false } }
    );
    assertHandlerCall(
      ['plugin', 'install', '--project'],
      { request: './commands/plugin.js', args: ['install'], options: { useProject: true } }
    );
    assertHandlerCall(
      ['workflow', 'set', 'specs', 'false', '--project'],
      { request: './commands/workflow.js', args: ['set', 'specs', 'false'], options: { useProject: true } }
    );
  });

  it('passes a memory search project filter without treating it as global scope', () => {
    assertHandlerCall(
      ['memory', 'search', '--project', 'HASH'],
      { request: './commands/memory.js', args: ['search', '--project', 'HASH'], options: { useProject: false } }
    );
  });

  it('preserves the global selector before memory search and keeps its nested filter', () => {
    assertHandlerCall(
      ['--project', 'memory', 'search', '--project', 'HASH'],
      { request: './commands/memory.js', args: ['search', '--project', 'HASH'], options: { useProject: true } }
    );
    assertHandlerCall(
      ['memory', '--project', 'search', 'term'],
      { request: './commands/memory.js', args: ['search', 'term'], options: { useProject: true } }
    );
  });

  it('awaits delayed handlers, preserves numeric results, and passes streams in context', async () => {
    const streams = createStreams();
    let completed = false;
    await withInstallHandler(async (_args, context) => {
      assert.equal(context.useProject, true);
      assert.equal(context.stdout, streams.stdout);
      assert.equal(context.stderr, streams.stderr);
      await new Promise((resolve) => setTimeout(resolve, 10));
      completed = true;
      return 7;
    }, async () => {
      assert.equal(await main(['--project', 'install'], streams), 7);
    });
    assert.equal(completed, true);
  });

  it('writes built-in help, version, and unknown-command output to injected streams', async () => {
    let streams = createStreams();
    assert.equal(await main(['--help'], streams), 0);
    assert.match(streams.output().stdout, /Usage:/);
    assert.equal(streams.output().stderr, '');

    streams = createStreams();
    assert.equal(await main(['--version'], streams), 0);
    assert.equal(streams.output().stdout, `${VERSION}\n`);
    assert.equal(streams.output().stderr, '');

    streams = createStreams();
    assert.equal(await main(['not-a-command'], streams), 1);
    assert.equal(streams.output().stderr, 'unknown command: not-a-command\n');
    assert.equal(streams.output().stdout, require('./help.js').HELP);
  });

  it('adds examples and color to top-level help only for an interactive output stream', async () => {
    await withEnv({ NO_COLOR: undefined, TERM: 'xterm-256color' }, async () => {
      const streams = createStreams({ stdoutTTY: true });
      assert.equal(await main(['--help'], streams), 0);
      const { stdout, stderr } = streams.output();
      assert.ok(stdout.includes('\u001b[1;36mUsage:\u001b[39m'));
      assert.match(stdout, /\u001b\[1;36mExamples:\u001b\[39m\n  guarana --help\n  guarana memory search "term" --project HASH\n  guarana workflow set specs false --project\n$/);
      assert.equal(stderr, '');
    });
  });

  it('adds an actionable hint and colors diagnostics only on an interactive error stream', async () => {
    await withEnv({ NO_COLOR: undefined, TERM: 'xterm-256color' }, async () => {
      const streams = createStreams({ stderrTTY: true });
      assert.equal(await main(['not-a-command'], streams), 1);
      assert.deepEqual(streams.output(), {
        stdout: require('./help.js').HELP,
        stderr: '\u001b[31munknown command: not-a-command\u001b[39m\nRun \'guarana --help\' for usage.\n',
      });

      await withInstallHandler(() => { throw new Error('handler failed'); }, async () => {
        const caught = createStreams({ stderrTTY: true });
        assert.equal(await main(['install'], caught), 1);
        assert.equal(caught.output().stderr,
          '\u001b[31mhandler failed\u001b[39m\nRun \'guarana --help\' for usage.\n');
      });
    });
  });

  it('routes plugin, web, memory, advisor, and specs diagnostics through the shared TTY formatter', async () => {
    await withEnv({ NO_COLOR: undefined, TERM: 'xterm-256color' }, async () => {
      const cases = [
        [['plugin', 'unknown'], 'unknown plugin command: unknown'],
        [['web', '--port', 'invalid'], 'invalid --port value: invalid'],
        [['memory', 'unknown'], 'unknown memory command: unknown'],
        [['advisor', 'unknown'], 'advisor: usage: guarana advisor <models|read|set|clear|status>'],
        [['specs', 'unknown'], 'unknown specs command: unknown'],
      ];

      for (const [args, message] of cases) {
        const baseline = createStreams();
        const tty = createStreams({ stderrTTY: true });
        assert.equal(await main(args, baseline), 1, args.join(' '));
        assert.equal(await main(args, tty), 1, args.join(' '));
        assert.equal(tty.output().stdout, baseline.output().stdout, `${args.join(' ')} stdout`);
        assert.equal(tty.output().stderr,
          `\u001b[31m${message}\u001b[39m\nRun 'guarana --help' for usage.\n`, args.join(' '));
      }
    });
  });

  it('formats actual install and update refusals caught at the main boundary', async () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-main-diagnostics-'));
    const originalCwd = process.cwd();
    const target = path.join(project, '.opencode', 'plugins', 'guarana-telemetry.js');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'foreign plugin\n');
    try {
      process.chdir(project);
      await withEnv({ NO_COLOR: undefined, TERM: 'xterm-256color' }, async () => {
        const message = `refuse to install: ${target} exists and was not installed by guarana (content differs from bundle)`;
        for (const command of ['install', 'update']) {
          const streams = createStreams({ stderrTTY: true });
          assert.equal(await main([command, '--project'], streams), 1, command);
          assert.deepEqual(streams.output(), {
            stdout: '',
            stderr: `\u001b[31m${message}\u001b[39m\nRun 'guarana --help' for usage.\n`,
          });
        }
      });
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('disables color for NO_COLOR and TERM=dumb while keeping interactive examples and hints', async () => {
    for (const env of [{ NO_COLOR: '1', TERM: 'xterm' }, { NO_COLOR: undefined, TERM: 'dumb' }]) {
      await withEnv(env, async () => {
        const help = createStreams({ stdoutTTY: true });
        assert.equal(await main(['-h'], help), 0);
        assert.match(help.output().stdout, /\nExamples:\n/);
        assert.doesNotMatch(help.output().stdout, /\u001b\[/);

        const error = createStreams({ stderrTTY: true });
        assert.equal(await main(['missing'], error), 1);
        assert.equal(error.output().stderr,
          "unknown command: missing\nRun 'guarana --help' for usage.\n");

        const commandError = createStreams({ stderrTTY: true });
        assert.equal(await main(['web', '--port', 'invalid'], commandError), 1);
        assert.equal(commandError.output().stderr,
          "invalid --port value: invalid\nRun 'guarana --help' for usage.\n");
      });
    }
  });

  it('does not repeat an embedded help hint and preserves exact non-TTY diagnostic bytes', async () => {
    const rawMessage = 'first line\r\nsecond line\0 café';
    const nonTTY = createStreams();
    stderrLine({ stderr: nonTTY.stderr }, rawMessage);
    assert.equal(nonTTY.output().stderr, `${rawMessage}\n`);

    await withEnv({ NO_COLOR: undefined, TERM: 'xterm-256color' }, async () => {
      const hint = "Run 'guarana --help' for usage.";
      const tty = createStreams({ stderrTTY: true });
      stderrLine({ stderr: tty.stderr }, `failure\n${hint}`);
      assert.equal(tty.output().stderr, `\u001b[31mfailure\n${hint}\u001b[39m\n`);
      assert.equal(tty.output().stderr.split(hint).length - 1, 1);
    });
  });

  it('preserves JSON error envelopes and non-error command stdout with TTY streams', async () => {
    const json = createStreams({ stdoutTTY: true, stderrTTY: true });
    assert.equal(await main(['specs', 'record', '--stdin', 'extra'], json), 1);
    assert.equal(json.output().stdout,
      '{"ok":false,"changed":[],"error":"usage: guarana specs record --stdin | --file .specs/state/worker-specs-handoff.json","validator":null}\n');
    assert.equal(json.output().stderr, '');

    const help = createStreams({ stdoutTTY: true, stderrTTY: true });
    assert.equal(await main(['specs', '--help'], help), 0);
    assert.equal(help.output().stdout, require('./commands/specs.js').HELP);
    assert.equal(help.output().stderr, '');
  });

  it('preserves exact non-interactive help and error bytes', async () => {
    const unknown = createStreams();
    assert.equal(await main(['unknown'], unknown), 1);
    assert.deepEqual(unknown.output(), {
      stdout: require('./help.js').HELP,
      stderr: 'unknown command: unknown\n',
    });

    await withInstallHandler(() => { throw new Error('failure bytes'); }, async () => {
      const caught = createStreams();
      assert.equal(await main(['install'], caught), 1);
      assert.deepEqual(caught.output(), { stdout: '', stderr: 'failure bytes\n' });
    });
  });

  it('prints synchronous and rejected handler errors to stderr and returns 1', async () => {
    for (const [run, message] of [
      [() => { throw new Error('sync handler failure'); }, 'sync handler failure'],
      [() => Promise.reject(new Error('async handler failure')), 'async handler failure'],
    ]) {
      const streams = createStreams();
      await withInstallHandler(run, async () => {
        assert.equal(await main(['install'], streams), 1);
      });
      assert.deepEqual(streams.output(), { stdout: '', stderr: `${message}\n` });
    }
  });

  it('rejects invalid handler results with a stable diagnostic without changing process state', async () => {
    const previousExitCode = process.exitCode;
    const diagnostic = 'command handler contract violation: expected integer exit code 0..255\n';
    try {
      process.exitCode = 23;
      for (const result of [undefined, null, '0', -1, 256, 1.5, NaN]) {
        const streams = createStreams();
        await withInstallHandler(() => result, async () => {
          assert.equal(await main(['install'], streams), 1);
        });
        assert.deepEqual(streams.output(), { stdout: '', stderr: diagnostic });
        assert.equal(process.exitCode, 23);
      }
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it('sets the executable exit status from the returned main result', () => {
    const result = runBin(['not-a-command']);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'unknown command: not-a-command');
    assert.match(result.stdout, /Usage:/);
  });

  it('reports a generic install guard refusal with status 1 through the executable', () => {
    const project = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'guarana-main-guard-'));
    const target = path.join(project, '.opencode', 'skills', 'guarana');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'SKILL.md'), 'name: another-skill\n');
    try {
      const result = runBin(['install', '--project'], { cwd: project });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, `refuse to install: ${target} exists but is not a guarana install (no .guarana-version stamp or guarana SKILL.md)\n`);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it('prints global help and returns status 1 for an unknown plugin subcommand', () => {
    const help = require('./help.js').HELP;
    for (const [args, diagnostic] of [
      [['plugin', 'unknown'], 'unknown plugin command: unknown\n'],
      [['plugin'], 'unknown plugin command: (missing)\n'],
    ]) {
      const result = runBin(args);
      assert.equal(result.status, 1);
      assert.equal(result.stderr, diagnostic);
      assert.equal(result.stdout, help);
    }
  });

  it('keeps exit-status mutation in the bin entry and process.exit out of dispatch handlers', () => {
    const dispatchSources = [MAIN, ...Object.keys(REGISTRY).map((name) => require.resolve(`./commands/${name}.js`))];
    assert.match(fs.readFileSync(BIN, 'utf8'), /\bprocess\.exitCode\s*=/);
    for (const file of dispatchSources) {
      const source = fs.readFileSync(file, 'utf8');
      assert.doesNotMatch(source, /\bprocess\.exitCode\b/, `${path.relative(__dirname, file)} must not access process.exitCode`);
      assert.doesNotMatch(source, /\bprocess\.exit\s*\(/, `${path.relative(__dirname, file)} must not call process.exit`);
    }
  });

  it('keeps command production output behind injected streams', () => {
    for (const name of Object.keys(REGISTRY)) {
      const file = require.resolve(`./commands/${name}.js`);
      const source = fs.readFileSync(file, 'utf8');
      assert.doesNotMatch(source, /\bconsole\s*\.\s*[A-Za-z_$][\w$]*/, `${name} must not call console methods`);
      assert.doesNotMatch(source, /\bprocess\s*\.\s*(?:stdout|stderr)\s*\.\s*write\s*\(/, `${name} must not write directly to process streams`);
    }
  });

  it('returns integer contract statuses from real handlers on success and handled paths', async () => {
    const os = require('node:os');
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-handler-contract-'));
    const originalCwd = process.cwd();
    const streams = createStreams();
    const context = { useProject: true, stdout: streams.stdout, stderr: streams.stderr };

    try {
      process.chdir(project);
      assert.equal(await REGISTRY.list.run([], context), 0);
      assert.equal(await REGISTRY.install.run([], context), 0);
      assert.equal(await REGISTRY.list.run([], context), 0);
      assert.equal(await REGISTRY.update.run([], context), 0);
      assert.equal(await REGISTRY.plugin.run(['status'], context), 0);
      assert.equal(await REGISTRY.memory.run(['--help'], context), 0);
      assert.equal(await REGISTRY.advisor.run(['read'], context), 0);
      assert.equal(REGISTRY.specs.run(['validate', path.join(__dirname, '..')], context), 0);
      assert.equal(await REGISTRY.uninstall.run([], context), 0);
      assert.equal(await REGISTRY.uninstall.run([], context), 0);

      const webStreams = createStreams();
      assert.equal(REGISTRY.web.run(['--port', '0'], webStreams), 1);
      assert.equal(webStreams.output().stderr, 'invalid --port value: 0\n');
      const failureStreams = createStreams();
      assert.equal(REGISTRY.web.run([], { ...failureStreams, serverDir: path.join(project, 'missing-dashboard') }), 1);
      assert.match(failureStreams.output().stderr, /dashboard not bundled:/);
      assert.ok(streams.output().stdout.length > 0);
      assert.equal(streams.output().stderr, '');
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(project, { recursive: true, force: true });
    }
  });
});

describe('shared command help metadata', () => {
  it('keeps registry names aligned with the top-level metadata commands', () => {
    assert.deepEqual(
      COMMANDS.map(({ name }) => name).sort(),
      ['advisor', 'install', 'list', 'memory', 'plugin', 'specs', 'uninstall', 'update', 'web', 'workflow'].sort()
    );
    assert.deepEqual(Object.keys(REGISTRY).sort(), COMMANDS.map(({ name }) => name).sort());

    const global = runBin(['--help']);
    assert.equal(global.status, 0, global.stderr);
    for (const { name } of COMMANDS) assert.ok(global.stdout.includes(`guarana ${name}`), `global help missing ${name}`);
  });

  it('renders memory, specs, and workflow usage rows identically in global and detailed help', () => {
    const global = runBin(['--help']);
    const memory = runBin(['memory', '--help']);
    const specs = runBin(['specs', '--help']);
    const workflow = runBin(['workflow', '--help']);
    assert.equal(global.status, 0, global.stderr);
    assert.equal(memory.status, 0, memory.stderr);
    assert.equal(specs.status, 0, specs.stderr);
    assert.equal(workflow.status, 0, workflow.stderr);

    for (const row of MEMORY.usageRows) {
      assert.ok(global.stdout.includes(row), `global help missing memory row: ${row}`);
      assert.ok(memory.stdout.includes(row), `memory help missing row: ${row}`);
    }
    for (const row of SPECS.usageRows) {
      assert.ok(global.stdout.includes(row), `global help missing specs row: ${row}`);
      assert.ok(specs.stdout.includes(row), `specs help missing row: ${row}`);
    }
    for (const row of WORKFLOW.usageRows) {
      assert.ok(global.stdout.includes(row), `global help missing workflow row: ${row}`);
      assert.ok(workflow.stdout.includes(row), `workflow help missing row: ${row}`);
    }
  });

  it('documents saved web launch settings and per-run overrides', () => {
    const global = runBin(['--help']);
    assert.equal(global.status, 0, global.stderr);
    assert.match(global.stdout, /guarana web \[--port N\] \[--open\|--no-open\]/);
    assert.match(global.stdout, /\.guarana\/web\.json or \$XDG_CONFIG_HOME\/guarana\/web\.json/);
    assert.match(global.stdout, /--port, --open, and --no-open override them for one run/);
  });

  it('documents workflow settings defaults, inheritance, and an example in top-level help', () => {
    const global = runBin(['--help']);
    assert.equal(global.status, 0, global.stderr);
    assert.match(global.stdout, /\.guarana\/workflow\.json or \$XDG_CONFIG_HOME\/guarana\/workflow\.json/);
    assert.match(global.stdout, /enabled by default; project/);
    assert.match(global.stdout, /guarana workflow set verify false --project/);
  });

  it('includes the required memory and specs forms and the nested project filter', () => {
    const global = runBin(['--help']);
    assert.equal(global.status, 0, global.stderr);
    assert.ok(global.stdout.includes('guarana memory compact [--threshold <n>]'));
    assert.ok(global.stdout.includes('guarana specs record --file .specs/state/worker-specs-handoff.json'));
    assert.ok(global.stdout.includes('    --project <hash>     Filter by project hash'));
  });

  it('documents the fixed memory vault and the post-search project hash filter', () => {
    const global = runBin(['--help']);
    assert.equal(global.status, 0, global.stderr);
    assert.ok(global.stdout.includes('Memory commands always use .guarana/memory/ under the current working directory.'));
    assert.ok(global.stdout.includes('A global --project before memory does not switch the memory vault.'));
    assert.ok(global.stdout.includes('After memory search, --project <hash> filters results by project hash.'));
    assert.ok(global.stdout.includes('Example: guarana memory search "term" --project HASH'));
    assert.ok(!global.stdout.includes('guarana --project memory search --project HASH'));
  });
});
