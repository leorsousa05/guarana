'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { discoverModels, discoverVariants, COMMAND_TIMEOUT_MS, MAX_OUTPUT_BYTES } = require('./opencode-model-catalog.js');

function fakeCli({ auth = '', models = '', errors = {} } = {}) {
  const calls = [];
  const execFile = (executable, args, options, callback) => {
    const command = args.join(' ');
    calls.push({ executable, args, options });
    queueMicrotask(() => {
      if (errors[command]) return callback(errors[command], '', 'credential-like stderr must not escape');
      callback(null, command === 'auth list' ? auth : models, '');
    });
  };
  return { calls, execFile };
}

test('catalog includes only models from authenticated providers and emits metadata only', async () => {
  assert.equal(COMMAND_TIMEOUT_MS, 15000, 'auth and model catalog commands each use the approved 15s timeout');
  const fake = fakeCli({
    auth: 'Authenticated providers:\n- anthropic\n- openai\n',
    models: 'anthropic/claude-sonnet-4\nopenai/gpt-5\ngemini/gemini-3-pro\n',
  });
  const result = await discoverModels({ cwd: '/project/root', executable: '/fake/opencode', execFile: fake.execFile });

  assert.deepEqual(result, {
    models: [
      { provider: { id: 'anthropic', name: 'anthropic' }, model: { id: 'claude-sonnet-4', name: 'claude-sonnet-4' } },
      { provider: { id: 'openai', name: 'openai' }, model: { id: 'gpt-5', name: 'gpt-5' } },
    ],
    error: null,
  });
  assert.equal(fake.calls.length, 2);
  assert.deepEqual(fake.calls.map(({ args }) => args), [['auth', 'list'], ['models']]);
  for (const call of fake.calls) {
    assert.equal(call.executable, '/fake/opencode');
    assert.equal(call.options.cwd, '/project/root');
    assert.equal(call.options.timeout, COMMAND_TIMEOUT_MS);
    assert.equal(call.options.maxBuffer, MAX_OUTPUT_BYTES);
    assert.equal(call.options.shell, false);
  }
  assert.equal(JSON.stringify(result).includes('API key'), false);
});

test('auth status glyphs and bordered multiword provider labels match catalog IDs', async () => {
  const fake = fakeCli({
    auth: [
      '● OpenAI api',
      '┌───────────────────┬────────┐',
      '│ Provider          │ Type   │',
      '├───────────────────┼────────┤',
      '│ ● GitHub Copilot  │ oauth  │',
      '└───────────────────┴────────┘',
    ].join('\n'),
    models: 'openai/gpt-5\ngithub-copilot/gpt-4.1\nanthropic/claude-sonnet-4\ngemini/gemini-3-pro\n',
  });
  const result = await discoverModels({ execFile: fake.execFile });
  const payload = JSON.stringify(result);

  assert.deepEqual(result.models.map(({ provider, model }) => `${provider.id}/${model.id}`), [
    'openai/gpt-5',
    'github-copilot/gpt-4.1',
  ]);
  assert.equal(result.error, null);
  assert.doesNotMatch(payload, /\b(?:api|oauth|anthropic|gemini)\b/i);
  assert.equal(fake.calls.length, 2);
});

test('whitespace-aligned auth rows parse provider columns and map OpenCode Console safely', async () => {
  const fake = fakeCli({
    auth: [
      'Provider                Auth           Status',
      'OpenAI                  OAuth          stored',
      'OpenCode Console        API key        stored',
      'OpenRouter              API key        stored',
    ].join('\n'),
    models: 'openai/gpt-4o\nopencode/gpt-5\nopenrouter/auto\nollama/llama3.2\n',
  });
  const result = await discoverModels({ cwd: '/project/root', execFile: fake.execFile });

  assert.deepEqual(result, {
    models: [
      { provider: { id: 'openai', name: 'openai' }, model: { id: 'gpt-4o', name: 'gpt-4o' } },
      { provider: { id: 'opencode', name: 'opencode' }, model: { id: 'gpt-5', name: 'gpt-5' } },
      { provider: { id: 'openrouter', name: 'openrouter' }, model: { id: 'auto', name: 'auto' } },
    ],
    error: null,
  });
  assert.deepEqual(Object.keys(result).sort(), ['error', 'models']);
  assert.doesNotMatch(JSON.stringify(result), /OAuth|API key|stored|OpenCode Console|ollama|llama3\.2/);
  assert.deepEqual(fake.calls.map(({ args }) => args), [['auth', 'list'], ['models']]);
});

test('ANSI-colored OpenCode auth table rows expose only connected catalog models', async () => {
  const auth = [
    '┌  Credentials \x1b[90m<path>',
    '│',
    '●  OpenAI \x1b[90mapi',
    '│',
    '●  GitHub Copilot \x1b[90moauth',
    '│',
    '└  2 credentials',
    '',
  ].join('\n');
  const fake = fakeCli({
    auth,
    models: 'openai/gpt-5\ngithub-copilot/gpt-4.1\nanthropic/claude-sonnet-4\ngemini/gemini-3-pro\n',
  });
  const result = await discoverModels({ execFile: fake.execFile });

  assert.deepEqual(fake.calls.map(({ args }) => args), [['auth', 'list'], ['models']]);
  assert.deepEqual(result.models.map(({ provider, model }) => `${provider.id}/${model.id}`), [
    'openai/gpt-5',
    'github-copilot/gpt-4.1',
  ]);
  assert.equal(result.error, null);
  assert.doesNotMatch(JSON.stringify(result), /\b(?:api|oauth|anthropic|claude-sonnet-4)\b/i);

  const filtered = fakeCli({
    auth,
    models: 'openai/gpt-5\ngithub-copilot/gpt-4.1\nanthropic/claude-sonnet-4\n',
  });
  const filteredResult = await discoverModels({ provider: 'openai', execFile: filtered.execFile });
  assert.deepEqual(filtered.calls.map(({ args }) => args), [['auth', 'list'], ['models', 'openai']]);
  assert.deepEqual(filteredResult.models.map(({ provider, model }) => `${provider.id}/${model.id}`), ['openai/gpt-5']);
  assert.equal(filteredResult.error, null);
});

test('provider filtering passes the provider to OpenCode and returns only its connected models', async () => {
  const fake = fakeCli({
    auth: 'openai\nanthropic\n',
    models: 'openai/gpt-5\nanthropic/claude-sonnet-4\n',
  });
  const result = await discoverModels({ provider: 'openai', execFile: fake.execFile });

  assert.deepEqual(fake.calls.map(({ args }) => args), [['auth', 'list'], ['models', 'openai']]);
  assert.deepEqual(result.models.map(({ provider, model }) => [provider.id, model.id]), [['openai', 'gpt-5']]);

  const disconnected = fakeCli({ auth: 'openai\n' });
  const missing = await discoverModels({ provider: 'anthropic', execFile: disconnected.execFile });
  assert.match(missing.error, /not connected/);
  assert.equal(disconnected.calls.length, 1);
});

test('preserves connected OpenRouter tilde subpaths and ignores invalid disconnected model IDs', async () => {
  const fake = fakeCli({
    auth: 'openrouter\n',
    models: 'openrouter/~anthropic/claude-fable-latest\ndisconnected/bad?model\n',
  });
  const result = await discoverModels({ execFile: fake.execFile });
  assert.equal(result.error, null);
  assert.deepEqual(result.models.map(({ provider, model }) => `${provider.id}/${model.id}`), [
    'openrouter/~anthropic/claude-fable-latest',
  ]);

  for (const models of ['openrouter/bad model\n', 'openrouter/bad\u0001model\n']) {
    const malformed = await discoverModels({ execFile: fakeCli({ auth: 'openrouter\n', models }).execFile });
    assert.deepEqual(malformed.models, []);
    assert.match(malformed.error, /malformed model data/);
  }
});

test('missing OpenCode, command failures, and no connected providers return actionable safe errors', async () => {
  const absent = fakeCli({ errors: { 'auth list': { code: 'ENOENT' } } });
  const absentResult = await discoverModels({ execFile: absent.execFile });
  assert.deepEqual(absentResult.models, []);
  assert.match(absentResult.error, /not installed/);

  const failed = fakeCli({ errors: { 'auth list': { code: 1, message: 'raw CLI error: API_KEY=private-value' } } });
  const failedResult = await discoverModels({ execFile: failed.execFile });
  assert.match(failedResult.error, /command failed/);
  assert.equal(JSON.stringify(failedResult).includes('credential-like'), false);
  assert.equal(JSON.stringify(failedResult).includes('raw CLI error'), false);
  assert.equal(JSON.stringify(failedResult).includes('private-value'), false);

  const noProviders = fakeCli({ auth: 'Provider  Type\n' });
  const empty = await discoverModels({ execFile: noProviders.execFile });
  assert.deepEqual(empty.models, []);
  assert.match(empty.error, /No OpenCode providers are connected/);
  assert.equal(noProviders.calls.length, 1);
});

test('malformed or credential-like command output is discarded without echoing its contents', async () => {
  const malformedProviders = fakeCli({ auth: 'Connected to account: secret-value' });
  const providerResult = await discoverModels({ execFile: malformedProviders.execFile });
  assert.deepEqual(providerResult.models, []);
  assert.match(providerResult.error, /malformed provider data/);
  assert.equal(JSON.stringify(providerResult).includes('secret-value'), false);

  const unknownRow = fakeCli({ auth: 'openai\nUnexpected authentication row!\n', models: 'openai/gpt-5\n' });
  const unknownResult = await discoverModels({ execFile: unknownRow.execFile });
  assert.deepEqual(unknownResult.models, []);
  assert.match(unknownResult.error, /malformed provider data/);
  assert.deepEqual(unknownRow.calls.map(({ args }) => args), [['auth', 'list']]);

  const malformedModels = fakeCli({ auth: 'openai\n', models: 'openai/gpt-5\nnot a model' });
  const modelResult = await discoverModels({ execFile: malformedModels.execFile });
  assert.deepEqual(modelResult.models, []);
  assert.match(modelResult.error, /malformed model data/);

  const credential = 'sk-live-secretvalue123456789';
  const exposed = fakeCli({ auth: `openai\n${credential}\n` });
  const sanitized = await discoverModels({ execFile: exposed.execFile });
  assert.deepEqual(sanitized.models, []);
  assert.equal(JSON.stringify(sanitized).includes(credential), false);
  assert.deepEqual(exposed.calls.map(({ args }) => args), [['auth', 'list']]);
});

test('credentials split by ANSI escapes are rejected after sanitization', async () => {
  const credential = 'sk-live-secretvalue123456789';
  const fake = fakeCli({ auth: `openai\nsk-\x1b[31mlive-secretvalue123456789\n` });
  const result = await discoverModels({ execFile: fake.execFile });

  assert.deepEqual(result.models, []);
  assert.match(result.error, /malformed provider data/);
  assert.equal(fake.calls.length, 1);
  assert.equal(JSON.stringify(result).includes(credential), false);
});

test('model command failures and invalid provider filters fail closed', async () => {
  const failedModels = fakeCli({ auth: 'openai\n', errors: { models: { code: 1 } } });
  const failed = await discoverModels({ execFile: failedModels.execFile });
  assert.match(failed.error, /command failed/);
  assert.deepEqual(failed.models, []);

  const invalid = await discoverModels({ provider: 'bad provider', execFile: failedModels.execFile });
  assert.match(invalid.error, /valid OpenCode provider ID/);
  assert.equal(failedModels.calls.length, 2);
});

test('variant discovery uses bounded project model.list and returns six validated exact-match variants', async () => {
  const fake = fakeCli({
    auth: 'openai\nopenrouter\n',
    models: JSON.stringify({
      data: [
        { providerID: 'openrouter', id: 'gpt-6-luna', variants: { wrongProvider: {} } },
        { providerID: 'openai', id: 'another-model', variants: { wrongModel: {} } },
        {
          providerID: 'openai',
          id: 'gpt-6-luna',
          variants: [
            { id: 'none', settings: {} },
            { id: 'low', settings: {} },
            { id: 'medium', settings: {} },
            { id: 'high', settings: {} },
            { id: 'xhigh', settings: {} },
            { id: 'max', settings: {} },
            { id: 'disabled', settings: {}, disabled: true },
            { id: 'invalid variant', settings: {} },
            { id: 'invalid-settings', settings: 'not an object' },
            { id: 'missing-settings' },
            { id: 'invalid-disabled', settings: {}, disabled: 'true' },
            null,
            'malformed entry',
          ],
        },
      ],
    }),
  });
  const result = await discoverVariants({ provider: 'openai', model: 'gpt-6-luna', cwd: '/project/root', execFile: fake.execFile });
  const apiCall = fake.calls[1];

  assert.deepEqual(result, { variants: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], error: null });
  assert.deepEqual(fake.calls.map(({ args }) => args), [
    ['auth', 'list'], ['api', 'model.list', '--param', 'location[directory]=/project/root'],
  ]);
  assert.equal(apiCall.options.cwd, '/project/root');
  assert.equal(apiCall.options.timeout, 10000);
  assert.equal(apiCall.options.maxBuffer, 2 * 1024 * 1024);
  assert.equal(apiCall.options.shell, false);
  assert.doesNotMatch(JSON.stringify(result), /settings/);
});

test('variant discovery rejects missing, malformed, oversized and unsafe model.list responses safely', async () => {
  const outputs = [
    { value: JSON.stringify({ data: [{ providerID: 'openai', id: 'other', variants: { wrong: {} } }] }), expected: /requested model/ },
    { value: '{ malformed', expected: /malformed variant metadata/ },
    { value: JSON.stringify({ data: { providerID: 'openai', id: 'gpt-5' } }), expected: /malformed variant metadata/ },
    { value: JSON.stringify({ data: [{ providerID: 'openai', id: 'gpt-5', variants: {} }] }), expected: /malformed variant metadata/ },
    { value: `${JSON.stringify({ data: [] })}${' '.repeat(2 * 1024 * 1024)}`, expected: /safe limit/ },
    { value: '{"data":[{"providerID":"openai","id":"gpt-5","variants":{}}],"authorization":"Bearer secretvalue"}', expected: /unsafe model metadata/ },
  ];
  for (const { value, expected } of outputs) {
    const fake = fakeCli({ auth: 'openai\n', models: value });
    const result = await discoverVariants({ provider: 'openai', model: 'gpt-5', execFile: fake.execFile });
    assert.deepEqual(result.variants, []);
    assert.match(result.error, expected);
    assert.doesNotMatch(JSON.stringify(result), /secretvalue|Bearer/);
  }
});

test('variant discovery requires a connected provider before querying model.list', async () => {
  const fake = fakeCli({ auth: 'anthropic\n', models: JSON.stringify({ data: [{ providerID: 'openai', id: 'gpt-5', variants: [{ id: 'high', settings: {} }] }] }) });
  assert.deepEqual(await discoverVariants({ provider: 'openai', model: 'gpt-5', execFile: fake.execFile }), { variants: [], error: null });
  assert.deepEqual(fake.calls.map(({ args }) => args), [['auth', 'list']]);
});

test('variant discovery fails softly for disconnected providers and command errors', async () => {
  const disconnected = fakeCli({ auth: 'openai\n' });
  assert.deepEqual(await discoverVariants({ provider: 'openrouter', model: 'model', execFile: disconnected.execFile }), { variants: [], error: null });
  const command = 'api model.list --param location[directory]=/project/root';
  const failed = fakeCli({ auth: 'openrouter\n', errors: { [command]: { code: 1, message: 'private secret' } } });
  const result = await discoverVariants({ provider: 'openrouter', model: 'model', cwd: '/project/root', execFile: failed.execFile });
  assert.deepEqual(result.variants, []);
  assert.match(result.error, /command failed/);
  assert.doesNotMatch(JSON.stringify(result), /private secret/);
});
