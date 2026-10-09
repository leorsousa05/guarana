import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('Models provides searchable role comboboxes, model variants, manual fallback, and ledger hierarchy', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { ModelsForm, applyCatalogSelection, applyProviderSelection, filterCatalogModels, filterCatalogProviders, comboboxKeyAction, settingsPayload } = await vite.ssrLoadModule('/src/components/Models.jsx');
  const catalog = { status: 'ready', models: [
    { provider: { id: 'anthropic', name: 'Anthropic' }, model: { id: 'claude-opus-4', name: 'Claude Opus 4' } },
    { provider: { id: 'openrouter', name: 'OpenRouter' }, model: { id: '~anthropic/claude-fable-latest', name: 'Claude Fable' } },
    { provider: { id: 'openai', name: 'OpenAI' }, model: { id: 'gpt-5', name: 'GPT 5' } },
  ] };
  const project = { primary: { provider: 'anthropic', model: 'claude-opus-4', variant: 'high' }, advisor: { provider: '', model: '', variant: '' } };
  const props = { project, sources: { primary: { provider: 'project', model: 'project', variant: 'project' }, advisor: {} }, effective: { primary: {}, advisor: {} }, catalog, onChange() {}, onSubmit() {}, saving: false, variants: { primary: { status: 'ready', values: ['high', 'low'] }, advisor: { status: 'error', values: [] } } };
  const html = renderToStaticMarkup(React.createElement(ModelsForm, props));
  assert.match(html, /Primary supplies agent\/profile defaults only; explicit or remembered OpenCode session model\/variant selections prevail/);
  assert.match(html, /Default model and variant for the Guarana agent in this scope, not a session override\./);
  assert.match(html, /Advisor consultations are optional/);
  assert.doesNotMatch(html, /Route project work to OpenCode models|Model used for project work/);
  assert.match(html, /<div class="models-roles">/);
  assert.match(html, /Optional second opinion when work is blocked/);
  assert.doesNotMatch(html, /runtime proof|Last observed completed execution|Runtime:/i);
  const modelSource = fs.readFileSync(path.join(webRoot, 'src/components/Models.jsx'), 'utf8');
  assert.doesNotMatch(modelSource, /\/api\/models\/runtime|runtimeState|RuntimeDetails/);
  for (const role of ['primary', 'advisor']) {
    assert.match(html, new RegExp(`id="model-${role}-provider-search"[^>]*role="combobox"`));
    assert.match(html, new RegExp(`id="model-${role}-search"[^>]*role="combobox"`));
    assert.match(html, new RegExp(`aria-label="${role === 'primary' ? 'Primary' : 'Advisor'} provider search"`));
    assert.match(html, new RegExp(`aria-label="${role === 'primary' ? 'Primary' : 'Advisor'} model search"`));
    assert.equal((html.match(new RegExp(`<input[^>]*id="model-${role}-variant"`, 'g')) || []).length, 1);
    assert.match(html, new RegExp(`<input[^>]*id="model-${role}-variant"[^>]*role="combobox"`));
    assert.match(html, new RegExp(`<input[^>]*id="model-${role}-variant"[^>]*type="text"`));
  }
  assert.doesNotMatch(html, /<datalist/);
  assert.doesNotMatch(html, /OpenCode default|no variant/i);
  assert.doesNotMatch(html, /model-(primary|advisor)-variant-custom/);
  assert.deepEqual(filterCatalogProviders(catalog.models, 'OPEN'), [{ id: 'openrouter', name: 'OpenRouter' }, { id: 'openai', name: 'OpenAI' }]);
  assert.deepEqual(filterCatalogProviders(catalog.models, 'anthropic').map((p) => p.id), ['anthropic']);
  assert.deepEqual(filterCatalogModels(catalog.models.filter((m) => m.provider.id === 'openrouter'), 'Fable').map(({ model }) => model.id), ['~anthropic/claude-fable-latest']);
  assert.deepEqual(comboboxKeyAction('ArrowDown', -1, 3), { activeIndex: 0 });
  assert.deepEqual(comboboxKeyAction('ArrowUp', 0, 3), { activeIndex: 2 });
  assert.deepEqual(comboboxKeyAction('ArrowUp', -1, 3), { activeIndex: 2 });
  assert.deepEqual(comboboxKeyAction('Enter', 1, 3), { select: 1 });
  assert.deepEqual(comboboxKeyAction('Escape', 1, 3), { close: true });
  // Static SSR cannot dispatch React input events; verify the model input transition
  // restores the open/no-active state after a catalog selection closes the list.
  const componentSource = fs.readFileSync(path.join(webRoot, 'src/components/Models.jsx'), 'utf8');
  assert.match(componentSource, /onChange=\{\(event\) => \{ const value = event\.target\.value; setSearches\(\(s\) => \(\{ \.\.\.s, \[role\]: value \}\)\); onChange\(role, 'model', value\); onChange\(role, 'variant', ''\); setActive\(\(a\) => \(\{ \.\.\.a, \[`\$\{role\}-model`\]: -1 \}\)\); \}\}/);
  assert.match(componentSource, /const variantValues = \[\.\.\.new Set\(variantState\.values \|\| \[\]\)\]/);
  assert.match(componentSource, /Your manually typed value will be kept/);
  assert.equal(comboboxKeyAction('ArrowDown', -1, 3).activeIndex, 0);

  // Provider suggestions are independent of the selected value; opening a selected
  // provider's combobox starts with the complete connected-provider catalog.
  assert.deepEqual(filterCatalogProviders(catalog.models, '' ).map(({ id }) => id), ['anthropic', 'openrouter', 'openai']);
  assert.deepEqual(filterCatalogProviders(catalog.models, 'openrouter').map(({ id }) => id), ['openrouter']);
  const providerChanges = [];
  applyProviderSelection('primary', 'openai', (...args) => providerChanges.push(args));
  assert.deepEqual(providerChanges, [['primary', 'provider', 'openai'], ['primary', 'model', ''], ['primary', 'variant', '']]);

  const updates = [];
  const variantsRequested = [];
  const selection = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, project: { primary: {}, advisor: {} }, onChange: (...args) => updates.push(args), onSelectModel: (...args) => variantsRequested.push(args) }));
  assert.match(selection, /Search provider name or ID/);
  const pick = JSON.stringify(['openrouter', '~anthropic/claude-fable-latest']);
  applyCatalogSelection('advisor', pick, (...args) => updates.push(args));
  assert.deepEqual(updates, [['advisor', 'provider', 'openrouter'], ['advisor', 'model', '~anthropic/claude-fable-latest'], ['advisor', 'variant', '']]);
  assert.ok(variantsRequested.length === 0); // selection callback is exercised by combobox event path in UI runtime
  assert.match(html, /Suggestions unavailable\. Manual entry works; blank uses the model default/);
  assert.match(html, /2 variant suggestions available; blank uses the model default/);
  const loadingVariants = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, variants: { primary: { status: 'loading', values: [] }, advisor: { status: 'idle', values: [] } } }));
  assert.match(loadingVariants, /Loading suggestions… Manual entry works; blank uses the model default/);
  assert.match(html, /class="models-source models-source--project">Project override/);
  assert.deepEqual(settingsPayload({ primary: { provider: 'custom', model: 'manual/model', variant: 'custom-v' }, advisor: { provider: '', model: '', variant: '' } }), { settings: { primary: { provider: 'custom', model: 'manual/model', variant: 'custom-v' } } });
  assert.deepEqual(settingsPayload({ primary: { provider: 'anthropic', model: 'claude-opus-4', variant: '' }, advisor: {} }), { settings: { primary: { provider: 'anthropic', model: 'claude-opus-4' } } });
  assert.deepEqual(settingsPayload({ primary: { provider: 'openrouter', model: '~anthropic/claude-fable-latest', variant: 'custom-v' }, advisor: {} }), { settings: { primary: { provider: 'openrouter', model: '~anthropic/claude-fable-latest', variant: 'custom-v' } } });
  assert.deepEqual(settingsPayload({ primary: {}, advisor: { enabled: false } }), { settings: { advisor: { enabled: false } } });
  assert.deepEqual(settingsPayload({ primary: {}, advisor: { enabled: undefined } }), { settings: {} });
  const defaultAdvisor = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, project: { primary: {}, advisor: {} }, sources: { advisor: { enabled: 'unset' } }, effective: { advisor: { enabled: false } } }));
  assert.match(defaultAdvisor, /aria-label="Advisor consultations"[^>]*type="checkbox"|type="checkbox"[^>]*aria-label="Advisor consultations"/);
  assert.match(defaultAdvisor, />Default: off</);
  const inheritedAdvisor = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, project: { primary: {}, advisor: {} }, sources: { advisor: { enabled: 'global' } }, effective: { advisor: { enabled: true, provider: 'openai', model: 'gpt-5' } } }));
  assert.match(inheritedAdvisor, /Using global setting: on/);
  assert.match(inheritedAdvisor, /Advisor consultations[^>]*checked/);
  const overriddenAdvisor = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, project: { primary: {}, advisor: { enabled: false } }, sources: { advisor: { enabled: 'project' } }, effective: { advisor: { enabled: false, provider: 'openai', model: 'gpt-5' } } }));
  assert.match(overriddenAdvisor, /Project override/);
  assert.match(overriddenAdvisor, /Use global setting/);
  const refreshed = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, project: { primary: { provider: 'anthropic', model: 'claude-opus-4', variant: 'saved-custom' }, advisor: { variant: 'current-stale' } }, variants: { primary: { status: 'ready', values: ['high'] }, advisor: { status: 'ready', values: ['low'] } } }));
  assert.match(refreshed, /id="model-primary-variant"[^>]*value="saved-custom"/);
  assert.match(refreshed, /id="model-advisor-variant"[^>]*value="current-stale"/);

  const states = ['loading', 'empty', 'error'];
  for (const status of states) assert.match(renderToStaticMarkup(React.createElement(ModelsForm, { ...props, catalog: { status, models: [] } })), new RegExp(status === 'loading' ? 'Checking the OpenCode catalog' : status === 'empty' ? 'No connected OpenCode models found' : 'OpenCode catalog unavailable'));
  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  assert.match(css, /\.models-roles\s*\{\s*display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 600px\)\s*\{\s*\.models-roles\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:focus-visible\s*\{\s*outline: 2px solid var\(--guarana\)/);
  assert.doesNotMatch(css, /\.models-runtime/);
});
