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
  const { ModelsForm, applyCatalogSelection, applyProviderSelection, filterCatalogModels, filterCatalogProviders, comboboxKeyAction, settingsPayload, effectiveFieldValue, fieldSource, providerModelMismatch, hasProviderModelMismatch, handleModelsSubmit, updateCatalogSearch, commitProviderSearchSelection, commitCatalogModelSelection, commitManualModelId, advisorCanEnable, loadConfiguredProjectVariants, fetchVariantSuggestions, createVariantLoader, catalogStateFromResponse } = await vite.ssrLoadModule('/src/components/Models.jsx');
  const catalog = { status: 'ready', models: [
    { provider: { id: 'anthropic', name: 'Anthropic' }, model: { id: 'claude-opus-4', name: 'Claude Opus 4' } },
    { provider: { id: 'openrouter', name: 'OpenRouter' }, model: { id: '~anthropic/claude-fable-latest', name: 'Claude Fable' } },
    { provider: { id: 'openai', name: 'OpenAI' }, model: { id: 'gpt-5', name: 'GPT 5' } },
  ] };
  const project = { primary: { provider: 'anthropic', model: 'claude-opus-4', variant: 'high' }, advisor: { provider: 'openai', model: 'gpt-5', variant: '' } };
  const props = { project, sources: { primary: { provider: 'project', model: 'project', variant: 'project' }, advisor: {} }, effective: { primary: {}, advisor: {} }, catalog, onChange() {}, onSubmit() {}, saving: false, variants: { primary: { provider: 'anthropic', model: 'claude-opus-4', status: 'ready', values: ['high', 'low'] }, advisor: { provider: 'openai', model: 'gpt-5', status: 'error', values: [] } } };
  const html = renderToStaticMarkup(React.createElement(ModelsForm, props));
  assert.match(html, /Primary sets Guarana profile defaults for this project; it does not change model or variant selections already made in an OpenCode session/);
  assert.match(html, /Default provider, model, and variant for this project’s Guarana profile\. Existing OpenCode session selections are unaffected/);
  assert.match(html, /Advisor is an optional, read-only second opinion/);
  assert.doesNotMatch(html, /Route project work to OpenCode models|Model used for project work/);
  assert.match(html, /<div class="models-roles">/);
  assert.match(html, /Optional read-only second opinion for work that is blocked/);
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
  const componentSource = fs.readFileSync(path.join(webRoot, 'src/components/Models.jsx'), 'utf8');
  assert.match(html, /Use this ID/);
  assert.match(html, /Effective provider: <code>anthropic<\/code> · project override/);
  assert.match(html, /Effective model: <code>claude-opus-4<\/code> · project override/);
  assert.match(componentSource, /const variantValues = \[\.\.\.new Set\(variantState\.values \|\| \[\]\)\]/);
  assert.match(componentSource, /Your manually typed value will be kept/);
  assert.equal(comboboxKeyAction('ArrowDown', -1, 3).activeIndex, 0);

  // Provider suggestions are independent of the selected value; opening a selected
  // provider's combobox starts with the complete connected-provider catalog.
  const inheritedGlobal = { primary: { provider: 'anthropic', model: 'claude-opus-4', variant: 'high' }, advisor: { provider: 'openai', model: 'gpt-5' } };
  assert.deepEqual(filterCatalogProviders(catalog.models, '' ).map(({ id }) => id), ['anthropic', 'openrouter', 'openai']);
  assert.deepEqual(filterCatalogProviders(catalog.models, 'openrouter').map(({ id }) => id), ['openrouter']);
  const providerChanges = [];
  applyProviderSelection('primary', 'openai', (...args) => providerChanges.push(args));
  assert.deepEqual(providerChanges, [['primary', 'provider', 'openai'], ['primary', 'model', ''], ['primary', 'variant', '']]);

  const updateState = (current, update) => typeof update === 'function' ? update(current) : update;
  let providerQueries = { primary: '' };
  let modelQueries = { primary: '' };
  let activeItems = {};
  const typedProject = { primary: { provider: 'anthropic', model: 'claude-opus-4' }, advisor: {} };
  const typedChanges = [];
  updateCatalogSearch({ target: { value: 'OpenAI' } }, 'primary', 'provider', (update) => { providerQueries = updateState(providerQueries, update); }, (update) => { activeItems = updateState(activeItems, update); });
  updateCatalogSearch({ target: { value: 'gpt-5' } }, 'primary', 'model', (update) => { modelQueries = updateState(modelQueries, update); }, (update) => { activeItems = updateState(activeItems, update); });
  assert.deepEqual(providerQueries, { primary: 'OpenAI' });
  assert.deepEqual(modelQueries, { primary: 'gpt-5' });
  assert.deepEqual(activeItems, { 'primary-provider': -1, 'primary-model': -1 });
  assert.deepEqual(typedProject, { primary: { provider: 'anthropic', model: 'claude-opus-4' }, advisor: {} }, 'typing changes query state only');
  assert.deepEqual(typedChanges, [], 'typing does not commit project setting IDs');

  let providerDraft = { primary: {}, advisor: {} };
  const providerCommitChanges = [];
  let committedModelQueries = { primary: 'old query' };
  let committedProviderQueries = { primary: 'OpenAI' };
  commitProviderSearchSelection('primary', 'openai', providerDraft, inheritedGlobal,
    (role, field, value) => { providerCommitChanges.push([role, field, value]); providerDraft = { ...providerDraft, [role]: { ...providerDraft[role], [field]: value } }; },
    (update) => { committedModelQueries = updateState(committedModelQueries, update); },
    (update) => { committedProviderQueries = updateState(committedProviderQueries, update); });
  assert.deepEqual(providerCommitChanges, [['primary', 'provider', 'openai'], ['primary', 'model', ''], ['primary', 'variant', '']]);
  assert.equal(hasProviderModelMismatch(providerDraft, inheritedGlobal), true, 'committing a new provider exposes the inherited-model mismatch');
  assert.deepEqual(committedModelQueries, { primary: '' });
  assert.deepEqual(committedProviderQueries, { primary: 'openai' });

  let catalogDraft = { primary: { provider: 'openai', variant: 'old' }, advisor: {} };
  const catalogCommitChanges = [];
  const variantRequests = [];
  let catalogProviderQueries = {};
  let catalogModelQueries = {};
  commitCatalogModelSelection('primary', 'openai', 'gpt-5', catalogDraft, inheritedGlobal,
    (role, field, value) => { catalogCommitChanges.push([role, field, value]); catalogDraft = { ...catalogDraft, [role]: { ...catalogDraft[role], [field]: value } }; },
    (update) => { catalogProviderQueries = updateState(catalogProviderQueries, update); },
    (update) => { catalogModelQueries = updateState(catalogModelQueries, update); },
    (...args) => variantRequests.push(args));
  assert.deepEqual(catalogCommitChanges, [['primary', 'provider', 'openai'], ['primary', 'model', 'gpt-5'], ['primary', 'variant', '']]);
  assert.deepEqual(variantRequests, [['primary', '["openai","gpt-5"]']]);
  assert.equal(catalogDraft.primary.model, 'gpt-5', 'catalog selection commits the exact catalog model ID');
  assert.equal(hasProviderModelMismatch(catalogDraft, inheritedGlobal), false, 'explicit catalog selection clears the guard');
  assert.deepEqual(catalogProviderQueries, { primary: 'openai' });
  assert.deepEqual(catalogModelQueries, { primary: 'gpt-5' });

  let manualDraft = { primary: { provider: 'openai', model: '' }, advisor: {} };
  const manualCommitChanges = [];
  let manualQueries = { primary: ' manual/custom-model ' };
  commitManualModelId('primary', manualQueries.primary, 'claude-opus-4',
    (role, field, value) => { manualCommitChanges.push([role, field, value]); manualDraft = { ...manualDraft, [role]: { ...manualDraft[role], [field]: value } }; },
    (update) => { manualQueries = updateState(manualQueries, update); });
  assert.deepEqual(manualCommitChanges, [['primary', 'model', 'manual/custom-model'], ['primary', 'variant', '']]);
  assert.equal(manualDraft.primary.provider, 'openai', 'manual model acceptance does not silently change provider');
  assert.equal(manualDraft.primary.model, 'manual/custom-model', 'Use this ID commits only the explicitly accepted model ID');
  assert.equal(hasProviderModelMismatch(manualDraft, inheritedGlobal), false, 'explicit manual model acceptance clears the guard');
  assert.deepEqual(manualQueries, { primary: 'manual/custom-model' });

  const updates = [];
  const variantsRequested = [];
  const selection = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, project: { primary: {}, advisor: {} }, onChange: (...args) => updates.push(args), onSelectModel: (...args) => variantsRequested.push(args) }));
  assert.match(selection, /Search provider name or ID/);
  const pick = JSON.stringify(['openrouter', '~anthropic/claude-fable-latest']);
  applyCatalogSelection('advisor', pick, (...args) => updates.push(args));
  assert.deepEqual(updates, [['advisor', 'provider', 'openrouter'], ['advisor', 'model', '~anthropic/claude-fable-latest'], ['advisor', 'variant', '']]);
  assert.ok(variantsRequested.length === 0); // this data-only helper does not request variants
  assert.match(html, /Suggestions unavailable\. Manual entry works; blank uses the model default/);
  assert.match(html, /2 variant suggestions available; blank uses the model default/);
  const loadingVariants = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, variants: { primary: { provider: 'anthropic', model: 'claude-opus-4', status: 'loading', values: [] }, advisor: { provider: 'openai', model: 'gpt-5', status: 'loading', values: [] } } }));
  assert.match(loadingVariants, /class="models-variant-spinner" aria-hidden="true"/);
  assert.match(loadingVariants, /role="status" aria-live="polite" aria-busy="true"/);
  assert.match(loadingVariants, /Loading Primary variant suggestions for anthropic\/claude-opus-4\. Manual entry works; blank uses the model default\./);
  assert.match(loadingVariants, /Loading Advisor variant suggestions for openai\/gpt-5\. Manual entry works; blank uses the model default\./);
  assert.equal((loadingVariants.match(/class="models-lookup" disabled=""/g) || []).length, 2);
  assert.match(html, /class="models-source models-source--project">Effective provider: <code>anthropic<\/code> · project override/);
  assert.deepEqual(settingsPayload({ primary: { provider: 'custom', model: 'manual/model', variant: 'custom-v' }, advisor: { provider: '', model: '', variant: '' } }), { settings: { primary: { provider: 'custom', model: 'manual/model', variant: 'custom-v' } } });
  assert.deepEqual(settingsPayload({ primary: { provider: 'anthropic', model: 'claude-opus-4', variant: '' }, advisor: {} }), { settings: { primary: { provider: 'anthropic', model: 'claude-opus-4' } } });
  assert.deepEqual(settingsPayload({ primary: { provider: 'openrouter', model: '~anthropic/claude-fable-latest', variant: 'custom-v' }, advisor: {} }), { settings: { primary: { provider: 'openrouter', model: '~anthropic/claude-fable-latest', variant: 'custom-v' } } });
  assert.deepEqual(settingsPayload({ primary: {}, advisor: { enabled: false } }), { settings: { advisor: { enabled: false } } });
  assert.deepEqual(settingsPayload({ primary: {}, advisor: { enabled: undefined } }), { settings: {} });
  assert.equal(effectiveFieldValue({ primary: {} }, inheritedGlobal, 'primary', 'provider'), 'anthropic');
  assert.equal(fieldSource({ primary: {} }, inheritedGlobal, 'primary', 'provider'), 'global');
  const mismatchProject = { primary: { provider: 'openai', model: '' }, advisor: {} };
  assert.equal(providerModelMismatch(mismatchProject, inheritedGlobal, 'primary'), true);
  assert.equal(hasProviderModelMismatch(mismatchProject, inheritedGlobal), true);
  const blockedForm = renderToStaticMarkup(React.createElement(ModelsForm, {
    ...props,
    project: mismatchProject,
    globalSettings: inheritedGlobal,
  }));
  assert.match(blockedForm, /The inherited global model belongs to anthropic\. Choose or enter a model for this provider before saving\./);
  assert.match(blockedForm, /class="models-save" type="submit" disabled=""/);
  let preventedMismatchSave = false;
  let mismatchSaveCalls = 0;
  assert.equal(handleModelsSubmit({ preventDefault() { preventedMismatchSave = true; } }, mismatchProject, inheritedGlobal, () => { mismatchSaveCalls += 1; }), false);
  assert.equal(preventedMismatchSave, true, 'the actual form submit handler blocks a mismatch');
  assert.equal(mismatchSaveCalls, 0, 'a blocked mismatch never reaches the save callback');

  const sameProviderProject = { primary: { provider: 'anthropic', model: '' }, advisor: {} };
  assert.equal(providerModelMismatch(sameProviderProject, inheritedGlobal, 'primary'), false);
  assert.equal(hasProviderModelMismatch(sameProviderProject, inheritedGlobal), false, 'same-provider global model inheritance remains valid');
  let sameProviderSaveCalls = 0;
  assert.equal(handleModelsSubmit({ preventDefault() {} }, sameProviderProject, inheritedGlobal, () => { sameProviderSaveCalls += 1; }), true);
  assert.equal(sameProviderSaveCalls, 1, 'same-provider inheritance reaches save');

  assert.deepEqual(settingsPayload({ primary: { provider: '', model: '', variant: '' }, advisor: { provider: '', model: '', variant: '' } }), { settings: {} }, 'inherited values are visible from global settings but omitted from a project payload');
  assert.deepEqual(settingsPayload({ primary: { provider: 'custom' }, advisor: {} }), { settings: { primary: { provider: 'custom' } } }, 'only an explicit project value is sent');
  assert.equal(fieldSource({ primary: { provider: undefined } }, inheritedGlobal, 'primary', 'provider'), 'global', 'restoring the global value resumes inheritance');
  assert.deepEqual(settingsPayload({ primary: { provider: undefined, model: undefined }, advisor: {} }), { settings: {} }, 'restored global fields are not re-sent as project overrides');
  const advisorDraft = { advisor: { provider: 'openai', model: 'gpt-5', enabled: true } };
  assert.equal(advisorCanEnable(advisorDraft, {}), true, 'complete draft values allow Advisor to be enabled before save');
  assert.deepEqual(settingsPayload(advisorDraft), { settings: { advisor: { provider: 'openai', model: 'gpt-5', enabled: true } } }, 'new Advisor config and enablement are submitted together');
  assert.equal(advisorCanEnable({ advisor: { provider: 'openai' } }, {}), false, 'Advisor needs an effective model too');
  const inheritedValuesHtml = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, project: { primary: {}, advisor: {} }, globalSettings: inheritedGlobal, sources: {}, effective: {} }));
  assert.match(inheritedValuesHtml, /Effective provider: <code>anthropic<\/code> · from global settings/);
  assert.match(inheritedValuesHtml, /Effective model: <code>claude-opus-4<\/code> · from global settings/);
  assert.match(inheritedValuesHtml, /Override global provider/);
  assert.match(inheritedValuesHtml, /Override global model/);
  assert.match(inheritedValuesHtml, /Blank uses the model default/);
  const savingHtml = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, saving: true }));
  assert.equal((savingHtml.match(/<fieldset class="models-section" disabled=""/g) || []).length, 2, 'all editable roles are disabled during save');
  assert.match(savingHtml, /role="status" aria-live="polite">Saving project settings and refreshing managed profiles… Editing is paused until the save finishes/);
  assert.match(savingHtml, /class="models-save" type="submit" disabled=""/);
  const feedbackHtml = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, error: 'Invalid model settings: advisor.model must be a non-empty OpenCode ID without whitespace', notice: 'Saved project profiles.' }));
  assert.match(feedbackHtml, /role="alert">Invalid model settings: advisor\.model must be a non-empty OpenCode ID without whitespace/);
  assert.match(feedbackHtml, /role="status">Saved project profiles\./);
  const defaultAdvisor = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, project: { primary: {}, advisor: {} }, sources: { advisor: { enabled: 'unset' } }, effective: { advisor: { enabled: false } } }));
  assert.match(defaultAdvisor, /aria-label="Advisor consultations"[^>]*type="checkbox"|type="checkbox"[^>]*aria-label="Advisor consultations"/);
  assert.match(defaultAdvisor, /Using global setting: off/);
  const inheritedAdvisor = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, project: { primary: {}, advisor: {} }, sources: { advisor: { enabled: 'global' } }, effective: { advisor: { enabled: true, provider: 'openai', model: 'gpt-5' } } }));
  assert.match(inheritedAdvisor, /Using global setting: on/);
  assert.match(inheritedAdvisor, /Advisor consultations[^>]*checked/);
  const overriddenAdvisor = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, project: { primary: {}, advisor: { enabled: false } }, sources: { advisor: { enabled: 'project' } }, effective: { advisor: { enabled: false, provider: 'openai', model: 'gpt-5' } } }));
  assert.match(overriddenAdvisor, /Project override/);
  assert.match(overriddenAdvisor, /Use global setting/);
  const refreshed = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, project: { primary: { provider: 'anthropic', model: 'claude-opus-4', variant: 'saved-custom' }, advisor: { variant: 'current-stale' } }, variants: { primary: { status: 'ready', values: ['high'] }, advisor: { status: 'ready', values: ['low'] } } }));
  assert.match(refreshed, /id="model-primary-variant"[^>]*value="saved-custom"/);
  assert.match(refreshed, /id="model-advisor-variant"[^>]*value="current-stale"/);
  const changedModel = renderToStaticMarkup(React.createElement(ModelsForm, {
    ...props,
    project: { primary: { provider: 'openai', model: 'gpt-new', variant: '' }, advisor: {} },
    variants: { primary: { provider: 'anthropic', model: 'claude-opus-4', status: 'ready', values: ['stale-choice'] } },
  }));
  assert.doesNotMatch(changedModel, /stale-choice/);

  const initialRequests = [];
  loadConfiguredProjectVariants({ primary: { provider: 'anthropic', model: 'claude-opus-4' }, advisor: { provider: 'openai', model: 'gpt-5' } }, (...args) => initialRequests.push(args));
  assert.deepEqual(initialRequests, [['primary', 'anthropic', 'claude-opus-4'], ['advisor', 'openai', 'gpt-5']]);
  const partialRequests = [];
  loadConfiguredProjectVariants({ primary: { provider: 'anthropic', model: 'claude-opus-4' }, advisor: {} }, (...args) => partialRequests.push(args));
  assert.deepEqual(partialRequests, [['primary', 'anthropic', 'claude-opus-4']]);

  const emptySuggestions = await fetchVariantSuggestions('openai', 'gpt-5', async (url) => {
    assert.equal(url, '/api/models/variants?provider=openai&model=gpt-5');
    return { ok: true, json: async () => ({ variants: [], error: null }) };
  });
  assert.deepEqual(emptySuggestions, []);
  await assert.rejects(fetchVariantSuggestions('openai', 'gpt-5', async () => ({
    ok: true,
    json: async () => ({ variants: [], error: 'OpenCode discovery timed out. Try again or enter model IDs manually.' }),
  })), /OpenCode discovery timed out/);
  const errorState = renderToStaticMarkup(React.createElement(ModelsForm, {
    ...props,
    variants: { ...props.variants, advisor: { provider: 'openai', model: 'gpt-5', status: 'error', values: [], error: 'OpenCode discovery timed out.' } },
  }));
  assert.match(errorState, /Suggestions unavailable: OpenCode discovery timed out\. Manual entry works; blank uses the model default\./);

  let resolveRequest;
  let requestCount = 0;
  let loaderState = {};
  const loader = createVariantLoader((update) => { loaderState = update(loaderState); }, () => {
    requestCount += 1;
    return new Promise((resolve) => { resolveRequest = resolve; });
  });
  const pendingRequest = loader('advisor', 'openai', 'gpt-5');
  await loader('advisor', 'openai', 'gpt-5');
  assert.equal(requestCount, 1, 'a second request for the loading model is ignored');
  assert.equal(loaderState.advisor.status, 'loading');
  resolveRequest(['high']);
  await pendingRequest;
  assert.deepEqual(loaderState.advisor, { provider: 'openai', model: 'gpt-5', status: 'ready', values: ['high'] });

  const catalogError = 'OpenCode discovery timed out. Try again or enter model IDs manually.';
  const failedCatalog = catalogStateFromResponse({ ok: true }, { models: [], error: catalogError });
  assert.deepEqual(failedCatalog, { status: 'error', models: [], error: catalogError });
  const failedCatalogHtml = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, catalog: failedCatalog }));
  assert.match(failedCatalogHtml, /OpenCode discovery timed out\. Try again or enter model IDs manually\. Enter provider and model IDs manually below\./);
  assert.match(failedCatalogHtml, /id="model-primary-provider-search"/);
  assert.match(failedCatalogHtml, /id="model-primary-search"/);

  const emptyCatalog = catalogStateFromResponse({ ok: true }, { models: [], error: null });
  assert.deepEqual(emptyCatalog, { status: 'empty', models: [], error: null });
  const emptyCatalogHtml = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, catalog: emptyCatalog }));
  assert.match(emptyCatalogHtml, /No connected OpenCode models found/);
  assert.doesNotMatch(emptyCatalogHtml, /OpenCode catalog unavailable|discovery timed out/);

  const pendingCatalogHtml = renderToStaticMarkup(React.createElement(ModelsForm, { ...props, catalog: { status: 'loading', models: [] } }));
  assert.match(pendingCatalogHtml, /class="models-catalog-status models-catalog-status--loading" role="status" aria-live="polite" aria-busy="true"/);
  assert.match(pendingCatalogHtml, /class="models-variant-spinner" aria-hidden="true"><\/span>Checking the OpenCode catalog/);
  assert.match(pendingCatalogHtml, /Checking the OpenCode catalog\. Provider and model IDs remain editable below\./);

  const states = ['loading', 'empty', 'error'];
  for (const status of states) assert.match(renderToStaticMarkup(React.createElement(ModelsForm, { ...props, catalog: { status, models: [] } })), new RegExp(status === 'loading' ? 'Checking the OpenCode catalog' : status === 'empty' ? 'No connected OpenCode models found' : 'OpenCode catalog unavailable'));
  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  assert.match(css, /\.models-roles\s*\{\s*display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 600px\)\s*\{\s*\.models-roles\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.models-variant-spinner\s*\{[^}]*animation: models-variant-spin/);
  assert.match(css, /\.models-catalog-status--loading\s*\{[^}]*display: flex[^}]*align-items: center/);
  assert.match(css, /#models \.models-variant-spinner\s*\{\s*animation: none;/);
  assert.match(css, /:focus-visible\s*\{\s*outline: 2px solid var\(--guarana\)/);
  assert.doesNotMatch(css, /\.models-runtime/);
});
