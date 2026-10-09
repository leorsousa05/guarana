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

test('variant discovery returns exact model variant keys only, including OpenRouter subpaths', async () => {
  const fake = fakeCli({
    auth: 'openrouter\n',
    models: [
      'openrouter/other', '{', '  "variants": { "unrelated": {} }', '}',
      'openrouter/~anthropic/claude-fable-latest', '{',
      '  "variants": { "high": { "temperature": 0.2, "headers": { "Authorization": "secret" } }, "disabled": { "disabled": true } },',
      '  "options": { "apiKey": "not returned" }', '}',
      'openrouter/third/nested', '{ "variants": { "other": {} } }',
    ].join('\n'),
  });
  const result = await discoverVariants({ provider: 'openrouter', model: '~anthropic/claude-fable-latest', execFile: fake.execFile });
  assert.deepEqual(result, { variants: ['high'], error: null });
  assert.deepEqual(fake.calls.map(({ args }) => args), [['auth', 'list'], ['models', 'openrouter', '--verbose']]);
  assert.doesNotMatch(JSON.stringify(result), /secret|Authorization|temperature|apiKey/);
});

test('variant discovery rejects missing, malformed, oversized and credential-like verbose blocks safely', async () => {
  const outputs = [
    { value: 'openai/other\n{ "variants": { "wrong": {} } }', expected: /requested model/ },
    { value: 'openai/gpt-5\n{ malformed', expected: /malformed variant metadata/ },
    { value: `openai/gpt-5\n{ "variants": {} }\n${' '.repeat(2 * 1024 * 1024)}`, expected: /safe limit/ },
    { value: 'openai/gpt-5\n{ "token": "Bearer secretvalue" }', expected: /unsafe model metadata/ },
  ];
  for (const { value, expected } of outputs) {
    const fake = fakeCli({ auth: 'openai\n', models: value });
    const result = await discoverVariants({ provider: 'openai', model: 'gpt-5', execFile: fake.execFile });
    assert.deepEqual(result.variants, []);
    assert.match(result.error, expected);
    assert.doesNotMatch(JSON.stringify(result), /secretvalue|Bearer/);
  }
});

test('variant discovery preserves connected-provider auth filtering', async () => {
  const fake = fakeCli({ auth: 'anthropic\n', models: 'openai/gpt-5\n{ "variants": { "high": {} } }' });
  assert.deepEqual(await discoverVariants({ provider: 'openai', model: 'gpt-5', execFile: fake.execFile }), { variants: [], error: null });
  assert.deepEqual(fake.calls.map(({ args }) => args), [['auth', 'list']]);
});

test('variant discovery fails softly for disconnected models and command errors', async () => {
  const disconnected = fakeCli({ auth: 'openai\n' });
  assert.deepEqual(await discoverVariants({ provider: 'openrouter', model: 'model', execFile: disconnected.execFile }), { variants: [], error: null });
  const failed = fakeCli({ auth: 'openrouter\n', errors: { 'models openrouter --verbose': { code: 1, message: 'private secret' } } });
  const result = await discoverVariants({ provider: 'openrouter', model: 'model', execFile: failed.execFile });
  assert.deepEqual(result.variants, []);
  assert.doesNotMatch(JSON.stringify(result), /private secret/);
});
