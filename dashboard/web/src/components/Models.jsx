import { useEffect, useRef, useState } from 'react';

const ROLES = [
  ['primary', 'Primary'],
  ['advisor', 'Advisor'],
];
const FIELDS = [
  ['provider', 'Provider'],
  ['model', 'Model ID'],
  ['variant', 'Variant (optional)'],
];

function emptyProject() {
  return { primary: {}, advisor: {} };
}

function projectValues(settings) {
  const values = Object.fromEntries(ROLES.map(([role]) => [
    role,
    Object.fromEntries(FIELDS.map(([field]) => [field, settings?.[role]?.[field] || ''])),
  ]));
  if (Object.hasOwn(settings?.advisor || {}, 'enabled')) values.advisor.enabled = settings.advisor.enabled;
  return values;
}

export function settingsPayload(project) {
  const settings = {};
  for (const [role, values] of Object.entries(project)) {
    const section = Object.fromEntries(Object.entries(values).filter(([field, value]) => field === 'enabled'
      ? typeof value === 'boolean'
      : typeof value === 'string' && value !== ''));
    if (Object.keys(section).length) settings[role] = section;
  }
  return { settings };
}

export function effectiveFieldValue(project, effective, role, field) {
  const draft = project?.[role]?.[field];
  return typeof draft === 'string' && draft !== '' ? draft : effective?.[role]?.[field] || '';
}

export function fieldSource(project, globalSettings, role, field) {
  if (typeof project?.[role]?.[field] === 'string' && project[role][field] !== '') return 'project';
  return Object.hasOwn(globalSettings?.[role] || {}, field) ? 'global' : 'unset';
}

export function providerModelMismatch(project, globalSettings, role) {
  const projectProvider = project?.[role]?.provider;
  const globalProvider = globalSettings?.[role]?.provider || '';
  const globalModel = globalSettings?.[role]?.model || '';
  const projectModel = project?.[role]?.model;
  return Boolean(projectProvider
    && projectProvider !== globalProvider
    && globalModel
    && !(typeof projectModel === 'string' && projectModel !== ''));
}

export function hasProviderModelMismatch(project, globalSettings) {
  return ROLES.some(([role]) => providerModelMismatch(project, globalSettings, role));
}

export function handleModelsSubmit(event, project, globalSettings, onSubmit) {
  if (hasProviderModelMismatch(project, globalSettings)) {
    event.preventDefault();
    return false;
  }
  onSubmit(event);
  return true;
}

export function advisorCanEnable(project, effective) {
  return Boolean(effectiveFieldValue(project, effective, 'advisor', 'provider')
    && effectiveFieldValue(project, effective, 'advisor', 'model'));
}

function modelChoiceValue(entry) {
  return JSON.stringify([entry.provider.id, entry.model.id]);
}

export function applyCatalogSelection(role, value, onChange) {
  if (!value) return;
  try {
    const selection = JSON.parse(value);
    if (!Array.isArray(selection)) return;
    const [provider, model] = selection;
    if (typeof provider !== 'string' || typeof model !== 'string') return;
    onChange(role, 'provider', provider);
    onChange(role, 'model', model);
    onChange(role, 'variant', '');
  } catch {
    // Ignore malformed selection values; the editable ID fields remain available.
  }
}

export function applyProviderSelection(role, provider, onChange) {
  if (typeof provider !== 'string') return;
  onChange(role, 'provider', provider);
  onChange(role, 'model', '');
  onChange(role, 'variant', '');
}

export function updateCatalogSearch(event, role, field, setSearches, setActive) {
  const value = event?.target?.value;
  if (typeof value !== 'string') return;
  setSearches((state) => ({ ...state, [role]: value }));
  setActive((state) => ({ ...state, [`${role}-${field}`]: -1 }));
}

export function commitProviderSearchSelection(role, provider, project, effective, setFieldValue, setSearches, setProviderSearches) {
  if (typeof provider !== 'string') return;
  const currentProvider = effectiveFieldValue(project, effective, role, 'provider');
  if (provider === currentProvider) setFieldValue(role, 'provider', provider);
  else applyProviderSelection(role, provider, setFieldValue);
  setSearches((state) => ({ ...state, [role]: '' }));
  setProviderSearches((state) => ({ ...state, [role]: provider }));
}

export function commitCatalogModelSelection(role, provider, model, project, effective, setFieldValue, setProviderSearches, setSearches, onSelectModel = () => {}) {
  if (typeof provider !== 'string' || typeof model !== 'string') return;
  const changed = provider !== effectiveFieldValue(project, effective, role, 'provider')
    || model !== effectiveFieldValue(project, effective, role, 'model');
  setFieldValue(role, 'provider', provider);
  setFieldValue(role, 'model', model);
  if (changed) setFieldValue(role, 'variant', '');
  setProviderSearches((state) => ({ ...state, [role]: provider }));
  setSearches((state) => ({ ...state, [role]: model }));
  onSelectModel(role, JSON.stringify([provider, model]));
}

export function commitManualModelId(role, id, currentModel, setFieldValue, setSearches) {
  if (typeof id !== 'string') return;
  const model = id.trim();
  if (!model) return;
  setFieldValue(role, 'model', model);
  if (model !== currentModel) setFieldValue(role, 'variant', '');
  setSearches((state) => ({ ...state, [role]: model }));
}

function validCatalogModels(models) {
  if (!Array.isArray(models)) return [];
  return models.filter((entry) => (
    typeof entry?.provider?.id === 'string' && typeof entry?.model?.id === 'string'
  ));
}

export function filterCatalogModels(models, query) {
  const term = String(query || '').toLowerCase();
  return validCatalogModels(models).filter(({ provider, model }) => (
    `${provider.id} ${model.id} ${model.name || ''}`.toLowerCase().includes(term)
  ));
}

export function filterCatalogProviders(models, query) {
  const term = String(query || '').toLowerCase();
  return [...new Map(validCatalogModels(models).map(({ provider }) => [provider.id, provider])).values()]
    .filter((provider) => `${provider.id} ${provider.name || ''}`.toLowerCase().includes(term));
}

export function comboboxKeyAction(key, activeIndex, count) {
  if (key === 'ArrowDown') return { activeIndex: count ? (activeIndex + 1) % count : -1 };
  if (key === 'ArrowUp') return { activeIndex: count ? (activeIndex < 0 ? count - 1 : (activeIndex - 1 + count) % count) : -1 };
  if (key === 'Escape') return { close: true };
  if (key === 'Enter' && activeIndex >= 0 && activeIndex < count) return { select: activeIndex };
  return null;
}

export function loadConfiguredProjectVariants(project, requestVariants) {
  for (const [role] of ROLES) {
    const { provider, model } = project?.[role] || {};
    if (provider && model) requestVariants(role, provider, model);
  }
}

export async function fetchVariantSuggestions(provider, model, request = fetch) {
  const query = new URLSearchParams({ provider, model });
  const response = await request(`/api/models/variants?${query}`);
  const body = await response.json();
  const detail = typeof body?.error === 'string' ? body.error.trim().slice(0, 240) : '';
  if (!response.ok || detail || !Array.isArray(body?.variants)) {
    throw new Error(detail || 'Variant suggestions are unavailable. Enter a variant manually or leave it blank to use the model default.');
  }
  return body.variants.filter((value) => typeof value === 'string');
}

export function createVariantLoader(setVariants, fetchSuggestions = fetchVariantSuggestions) {
  const inFlight = new Map();
  const latestRequest = new Map();
  return async (role, provider, model) => {
    if (!provider || !model) return;
    const key = JSON.stringify([provider, model]);
    if (inFlight.get(role)?.key === key) return;
    const request = {};
    inFlight.set(role, { key, request });
    latestRequest.set(role, request);
    setVariants((current) => ({ ...current, [role]: { provider, model, status: 'loading', values: [] } }));
    try {
      const values = await fetchSuggestions(provider, model);
      if (latestRequest.get(role) !== request) return;
      setVariants((current) => ({ ...current, [role]: { provider, model, status: 'ready', values } }));
    } catch (cause) {
      if (latestRequest.get(role) !== request) return;
      setVariants((current) => ({ ...current, [role]: {
        provider,
        model,
        status: 'error',
        values: [],
        error: typeof cause?.message === 'string' ? cause.message : '',
      } }));
    } finally {
      if (inFlight.get(role)?.request === request) inFlight.delete(role);
    }
  };
}

function catalogMessage(catalog, models) {
  if (catalog?.status === 'loading') return 'Checking the OpenCode catalog. Provider and model IDs remain editable below.';
  if (catalog?.status === 'error') return `${catalog.error || 'OpenCode catalog unavailable.'} Enter provider and model IDs manually below.`;
  if (models.length === 0) return 'No connected OpenCode models found. Enter provider and model IDs manually below.';
  const providers = [...new Set(models.map(({ provider }) => provider.id))];
  return `Connected OpenCode providers: ${providers.join(', ')}. Select a model to fill the provider and model fields.`;
}

export function catalogStateFromResponse(response, body) {
  if (!response.ok || body?.error || !Array.isArray(body?.models)) {
    return {
      status: 'error',
      models: [],
      error: typeof body?.error === 'string' ? body.error : '',
    };
  }
  const models = validCatalogModels(body.models);
  return { status: models.length ? 'ready' : 'empty', models, error: null };
}

function optionId(role, field, index) {
  return `model-${role}-${field}-option-${index}`;
}

export function ModelsForm({
  project,
  globalSettings,
  effective,
  onChange,
  onSubmit,
  saving,
  error,
  notice,
  catalog = { status: 'empty', models: [] },
  variants = {},
  onSelectModel = () => {},
  onRequestVariants = () => {},
}) {
  const [searches, setSearches] = useState({ primary: project?.primary?.model || '', advisor: project?.advisor?.model || '' });
  const [providerSearches, setProviderSearches] = useState({ primary: project?.primary?.provider || '', advisor: project?.advisor?.provider || '' });
  const [active, setActive] = useState({});
  const [variantOpen, setVariantOpen] = useState({});
  const [variantActive, setVariantActive] = useState({});
  const models = validCatalogModels(catalog.models);
  const message = catalogMessage(catalog, models);
  const catalogLoading = catalog?.status === 'loading';
  const connectedProviders = filterCatalogProviders(models, '');
  const baseSettings = globalSettings || effective || {};
  const setFieldValue = (role, field, value) => onChange(role, field, value);
  const acceptProvider = (role, provider) => commitProviderSearchSelection(
    role, provider, project, baseSettings, setFieldValue, setSearches, setProviderSearches,
  );
  const acceptModel = (role, provider, model) => commitCatalogModelSelection(
    role, provider, model, project, baseSettings, setFieldValue, setProviderSearches, setSearches, onSelectModel,
  );
  const restoreGlobal = (role, field) => {
    setFieldValue(role, field, undefined);
    if (field === 'provider') {
      setFieldValue(role, 'model', '');
      setFieldValue(role, 'variant', '');
      setProviderSearches((state) => ({ ...state, [role]: '' }));
      setSearches((state) => ({ ...state, [role]: '' }));
    } else if (field === 'model') {
      setSearches((state) => ({ ...state, [role]: '' }));
    }
  };
  return (
    <section id="models" aria-label="Models">
      <h2 className="section-title">Models</h2>
      <p className="models-intro">Primary sets Guarana profile defaults for this project; it does not change model or variant selections already made in an OpenCode session. Advisor is an optional, read-only second opinion. Project values override global defaults only when you choose an override. Credentials stay in OpenCode.</p>
      <p id="models-catalog-status" className={`models-catalog-status${catalogLoading ? ' models-catalog-status--loading' : ''}`} role="status" aria-live="polite" aria-busy={catalogLoading || undefined}>
        {catalogLoading && <span className="models-variant-spinner" aria-hidden="true" />}
        {message}
      </p>
        <form className="models-form" onSubmit={(event) => handleModelsSubmit(event, project, baseSettings, onSubmit)}>
        <div className="models-roles">{ROLES.map(([role, title]) => {
          const provider = effectiveFieldValue(project, baseSettings, role, 'provider');
          const model = effectiveFieldValue(project, baseSettings, role, 'model');
          const providerSource = fieldSource(project, baseSettings, role, 'provider');
          const modelSource = fieldSource(project, baseSettings, role, 'model');
          const variantSource = fieldSource(project, baseSettings, role, 'variant');
          const modelMismatch = providerModelMismatch(project, baseSettings, role);
          const providerOptions = filterCatalogProviders(models, providerSearches[role] || '');
          const filteredModels = filterCatalogModels(models.filter((entry) => !provider || entry.provider.id === provider), searches[role]);
          const storedVariantState = variants[role];
          const variantState = storedVariantState?.provider === provider && storedVariantState?.model === model
            ? storedVariantState
            : { status: 'idle', values: [] };
          const currentVariant = project?.[role]?.variant || '';
          const resolvedVariant = effectiveFieldValue(project, baseSettings, role, 'variant');
          const variantValues = [...new Set(variantState.values || [])];
          const providerOpen = active[`${role}-provider`] !== undefined;
          const modelOpen = active[`${role}-model`] !== undefined;
          const matchingVariants = variantValues.filter((value) => value.toLowerCase().includes(currentVariant.toLowerCase()));
          const variantMessage = variantState.status === 'loading'
            ? `Loading ${title} variant suggestions for ${provider}/${model}. Manual entry works; blank uses the model default.`
            : variantOpen[role]
            ? `${matchingVariants.length ? `${matchingVariants.length} variant suggestion${matchingVariants.length === 1 ? '' : 's'} found.` : 'No variant suggestions match. Your manually typed value will be kept.'}${variantState.status === 'error' ? variantState.error ? ` Suggestions unavailable: ${variantState.error} Manual entry works; blank uses the model default.` : ' Suggestions unavailable. Manual entry works; blank uses the model default.' : !matchingVariants.length ? ' Blank uses the model default.' : ''}`
            : variantState.status === 'error'
              ? variantState.error
                ? `Suggestions unavailable: ${variantState.error} Manual entry works; blank uses the model default.`
                : 'Suggestions unavailable. Manual entry works; blank uses the model default.'
              : variantState.status === 'ready'
                ? `${variantValues.length} variant suggestion${variantValues.length === 1 ? '' : 's'} available; blank uses the model default.`
                : 'Choose a model to load variant suggestions.';
          return (
            <fieldset className="models-section" key={role} disabled={saving}>
              <legend>{role === 'primary' ? 'Primary' : 'Advisor'}</legend>
              <p className="models-role-description">{role === 'primary' ? 'Default provider, model, and variant for this project’s Guarana profile. Existing OpenCode session selections are unaffected.' : 'Optional read-only second opinion for work that is blocked.'}</p>
              {role === 'advisor' && (() => {
                const enabledSource = typeof project?.advisor?.enabled === 'boolean' ? 'project' : Object.hasOwn(baseSettings?.advisor || {}, 'enabled') ? 'global' : 'unset';
                const enabled = typeof project?.advisor?.enabled === 'boolean' ? project.advisor.enabled : baseSettings?.advisor?.enabled === true;
                const configured = advisorCanEnable(project, baseSettings);
                return <div className="models-advisor-toggle">
                  <label><input type="checkbox" aria-label="Advisor consultations" checked={enabled} disabled={!enabled && !configured} onChange={(event) => onChange('advisor', 'enabled', event.target.checked)} /> Enable Advisor</label>
                  <small className={`models-source models-source--${enabledSource}`}>{enabledSource === 'project' ? 'Project override' : enabledSource === 'global' ? `Using global setting: ${enabled ? 'on' : 'off'}` : 'Default: off'}</small>
                  {typeof project?.advisor?.enabled === 'boolean' && <button type="button" className="models-inherit" onClick={() => onChange('advisor', 'enabled', undefined)}>Use global setting</button>}
                </div>;
              })()}
              <div className="models-discovery">
                <div className="models-catalog-field">
                <label htmlFor={`model-${role}-provider-search`}>Provider</label>
                <input id={`model-${role}-provider-search`} type="search" role="combobox" aria-label={`${title} provider search`} aria-expanded={providerOpen} aria-controls={providerOpen ? `model-${role}-providers` : undefined} aria-activedescendant={active[`${role}-provider`] >= 0 ? optionId(role, 'provider', active[`${role}-provider`]) : undefined} aria-autocomplete="list" value={providerSearches[role] || ''} placeholder="Search provider name or ID" onFocus={() => setActive((a) => ({ ...a, [`${role}-provider`]: -1 }))} onChange={(event) => updateCatalogSearch(event, role, 'provider', setProviderSearches, setActive)} onKeyDown={(event) => { const action = comboboxKeyAction(event.key, active[`${role}-provider`] ?? -1, providerOptions.length); if (!action) return; event.preventDefault(); if (action.close) setActive((a) => { const next = { ...a }; delete next[`${role}-provider`]; return next; }); else if (action.select !== undefined) { acceptProvider(role, providerOptions[action.select].id); setActive((a) => ({ ...a, [`${role}-provider`]: undefined })); } else setActive((a) => ({ ...a, [`${role}-provider`]: action.activeIndex })); }} />
                {providerOpen && <ul id={`model-${role}-providers`} className="models-options" role="listbox">{providerOptions.map((option, index) => <li key={option.id}><button id={optionId(role, 'provider', index)} type="button" role="option" aria-selected={active[`${role}-provider`] === index} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => { acceptProvider(role, option.id); setActive((a) => ({ ...a, [`${role}-provider`]: undefined })); }}>{option.name || option.id} <small>{option.id}</small></button></li>)}</ul>}
                  {providerOpen && <small className="models-result-count" role="status" aria-live="polite">{providerOptions.length ? `${providerOptions.length} connected provider${providerOptions.length === 1 ? '' : 's'} found.` : 'No connected match. Enter a provider ID and confirm it below.'}</small>}
                  {!providerOpen && <small className="models-field-hint">{connectedProviders.length} connected providers · Search by name or ID</small>}
                  <small className={`models-source models-source--${providerSource}`}>Effective provider: <code>{provider || 'Not configured'}</code> · {providerSource === 'project' ? 'project override' : providerSource === 'global' ? 'from global settings' : 'no project or global value'}</small>
                  {providerSource === 'global' && <button type="button" className="models-inherit" onClick={() => { setFieldValue(role, 'provider', provider); setProviderSearches((state) => ({ ...state, [role]: provider })); }}>Override global provider</button>}
                  {project?.[role]?.provider && <button type="button" className="models-inherit" onClick={() => restoreGlobal(role, 'provider')}>{Object.hasOwn(baseSettings?.[role] || {}, 'provider') ? 'Use global provider' : 'Clear project override'}</button>}
                  {!!providerSearches[role]?.trim() && <button type="button" className="models-inherit models-manual" onClick={() => acceptProvider(role, providerSearches[role].trim())}>Use this ID</button>}
                </div>
                <div className="models-catalog-field">
                <label htmlFor={`model-${role}-search`}>Model</label>
                <input id={`model-${role}-search`} role="combobox" aria-label={`${title} model search`} aria-expanded={modelOpen} aria-controls={modelOpen ? `model-${role}-options` : undefined} aria-activedescendant={active[`${role}-model`] >= 0 ? optionId(role, 'model', active[`${role}-model`]) : undefined} aria-autocomplete="list" type="search" value={searches[role] || ''} placeholder="Search model name or ID" onFocus={() => setActive((a) => ({ ...a, [`${role}-model`]: -1 }))} onChange={(event) => updateCatalogSearch(event, role, 'model', setSearches, setActive)} onKeyDown={(event) => { const action = comboboxKeyAction(event.key, active[`${role}-model`] ?? -1, filteredModels.length); if (!action) return; event.preventDefault(); if (action.close) setActive((a) => { const next = { ...a }; delete next[`${role}-model`]; return next; }); else if (action.select !== undefined) { const entry = filteredModels[action.select]; acceptModel(role, entry.provider.id, entry.model.id); setActive((a) => ({ ...a, [`${role}-model`]: undefined })); } else setActive((a) => ({ ...a, [`${role}-model`]: action.activeIndex })); }} />
                {modelOpen && <ul id={`model-${role}-options`} className="models-options" role="listbox">{filteredModels.map((entry, index) => <li key={modelChoiceValue(entry)}><button id={optionId(role, 'model', index)} type="button" role="option" aria-selected={active[`${role}-model`] === index} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => { acceptModel(role, entry.provider.id, entry.model.id); setActive((a) => ({ ...a, [`${role}-model`]: undefined })); }}>{entry.model.name || entry.model.id} <small>{entry.model.id}</small></button></li>)}</ul>}
                  {modelOpen && <small className="models-result-count" role="status" aria-live="polite">{filteredModels.length ? `${filteredModels.length} model${filteredModels.length === 1 ? '' : 's'} found${provider ? ` for ${provider}` : ''}.` : 'No catalog match. Enter a model ID and confirm it below.'}</small>}
                  {!modelOpen && <small className="models-field-hint">{provider ? `${provider} catalog · Search model name or ID` : 'Search model name or ID; choose a provider to narrow results'}</small>}
                  <small className={`models-source models-source--${modelSource}`}>Effective model: <code>{model || 'Not configured'}</code> · {modelSource === 'project' ? 'project override' : modelSource === 'global' ? 'from global settings' : 'no project or global value'}</small>
                  {modelMismatch && <small className="models-model-warning" role="alert">The inherited global model belongs to {baseSettings?.[role]?.provider || 'a different provider'}. Choose or enter a model for this provider before saving.</small>}
                  {modelSource === 'global' && <button type="button" className="models-inherit" onClick={() => { setFieldValue(role, 'model', model); setSearches((state) => ({ ...state, [role]: model })); }}>Override global model</button>}
                  {project?.[role]?.model && <button type="button" className="models-inherit" onClick={() => restoreGlobal(role, 'model')}>{Object.hasOwn(baseSettings?.[role] || {}, 'model') ? 'Use global model' : 'Clear project override'}</button>}
                  {!!searches[role]?.trim() && <button type="button" className="models-inherit models-manual" onClick={() => commitManualModelId(role, searches[role], model, setFieldValue, setSearches)}>Use this ID</button>}
                </div>
              </div>
              <div className="models-fields">
                {FIELDS.map(([field]) => {
                  if (field !== 'variant') return null;
                  const id = `model-${role}-${field}`;
                  const source = variantSource;
                  return (
                    <div className="models-field" key={field}>
                      <label htmlFor={id}>Model variant</label>
                      {field === 'variant' ? <>
                      <input id={id} name={`${role}.${field}`} type="text" autoComplete="off" role="combobox" aria-expanded={!!variantOpen[role]} aria-controls={variantOpen[role] ? `${id}-suggestions` : undefined} aria-activedescendant={variantActive[role] >= 0 ? `${id}-option-${variantActive[role]}` : undefined} aria-autocomplete="list" value={currentVariant} placeholder="Search or type a variant" onFocus={() => { setVariantOpen((state) => ({ ...state, [role]: true })); setVariantActive((state) => ({ ...state, [role]: -1 })); }} onBlur={() => { setVariantOpen((state) => ({ ...state, [role]: false })); setVariantActive((state) => ({ ...state, [role]: -1 })); }} onChange={(event) => { onChange(role, 'variant', event.target.value); setVariantOpen((state) => ({ ...state, [role]: true })); setVariantActive((state) => ({ ...state, [role]: -1 })); }} onKeyDown={(event) => { const index = variantActive[role] ?? -1; let next; if (event.key === 'ArrowDown') next = matchingVariants.length ? (index + 1) % matchingVariants.length : -1; else if (event.key === 'ArrowUp') next = matchingVariants.length ? (index < 0 ? matchingVariants.length - 1 : (index - 1 + matchingVariants.length) % matchingVariants.length) : -1; else if (event.key === 'Escape') { event.preventDefault(); setVariantOpen((state) => ({ ...state, [role]: false })); setVariantActive((state) => ({ ...state, [role]: -1 })); return; } else if (event.key === 'Enter' && index >= 0 && index < matchingVariants.length) { event.preventDefault(); onChange(role, 'variant', matchingVariants[index]); setVariantOpen((state) => ({ ...state, [role]: false })); setVariantActive((state) => ({ ...state, [role]: -1 })); return; } else return; event.preventDefault(); setVariantOpen((state) => ({ ...state, [role]: true })); setVariantActive((state) => ({ ...state, [role]: next })); }} aria-label={`${title} variant`} aria-describedby={`${id}-source ${id}-status`} />
                      {variantOpen[role] && <ul id={`${id}-suggestions`} className="models-options models-variant-options" role="listbox">{matchingVariants.map((variant, index) => <li key={variant}><button id={`${id}-option-${index}`} type="button" role="option" aria-selected={variantActive[role] === index} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(role, 'variant', variant); setVariantOpen((state) => ({ ...state, [role]: false })); setVariantActive((state) => ({ ...state, [role]: -1 })); }}>{variant}</button></li>)}</ul>}
                      <div className="models-variant-meta">
                        <button type="button" className="models-lookup" onClick={() => onRequestVariants(role)} disabled={!provider || !model || variantState.status === 'loading'}>{variantState.status === 'ready' ? 'Refresh suggestions' : 'Load suggestions'}</button>
                        <small id={`${id}-status`} className={`models-variant-status${variantState.status === 'loading' ? ' models-variant-status--loading' : ''}`} role="status" aria-live="polite" aria-busy={variantState.status === 'loading' || undefined}>
                          {variantState.status === 'loading' && <span className="models-variant-spinner" aria-hidden="true" />}
                          {variantMessage}
                        </small>
                      </div>
                      </> : <input
                        id={id}
                        name={`${role}.${field}`}
                        type="text"
                        autoComplete="off"
                        value={project?.[role]?.[field] || ''}
                        onChange={(event) => onChange(role, field, event.target.value)}
                        aria-describedby={`${id}-source`}
                      />}
                      <small id={`${id}-source`} className={`models-source models-source--${source}`}>{resolvedVariant ? <>Effective variant: <code>{resolvedVariant}</code> · {source === 'project' ? 'project override' : source === 'global' ? 'from global settings' : 'not configured'}</> : 'Blank uses the model default.'}</small>
                      {source === 'global' && resolvedVariant && <button type="button" className="models-inherit" onClick={() => onChange(role, 'variant', resolvedVariant)}>Override global variant</button>}
                      {project?.[role]?.variant && <button type="button" className="models-inherit" onClick={() => onChange(role, 'variant', undefined)}>{Object.hasOwn(baseSettings?.[role] || {}, 'variant') ? 'Use global variant' : 'Clear project override'}</button>}
                      </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}</div>
        {error && <p className="models-feedback models-feedback--error" role="alert">{error}</p>}
        {notice && <p className="models-feedback models-feedback--success" role="status">{notice}</p>}
        <p className="models-save-scope">Saving updates this project’s model settings and managed profiles. It does not change selections in an already-running OpenCode session.</p>
        {saving && <p className="models-feedback" role="status" aria-live="polite">Saving project settings and refreshing managed profiles… Editing is paused until the save finishes.</p>}
        <button className="models-save" type="submit" disabled={saving || hasProviderModelMismatch(project, baseSettings)}>
          {saving ? 'Saving…' : 'Save project models'}
        </button>
      </form>
    </section>
  );
}

export function Models() {
  const [settings, setSettings] = useState(null);
  const [project, setProject] = useState(emptyProject);
  const [catalog, setCatalog] = useState({ status: 'loading', models: [] });
  const [variants, setVariants] = useState({});
  const variantLoader = useRef(null);
  if (!variantLoader.current) variantLoader.current = createVariantLoader(setVariants);
  const [loadingError, setLoadingError] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/models')
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || `${response.status} ${response.statusText}`);
        if (!cancelled) {
          setSettings(body);
          setProject(projectValues(body.project));
        }
      })
      .catch((cause) => {
        if (!cancelled) setLoadingError(cause.message);
      });

    fetch('/api/models/catalog')
      .then(async (response) => {
        const body = await response.json();
        return catalogStateFromResponse(response, body);
      })
      .catch(() => ({ status: 'error', models: [], error: '' }))
      .then((result) => {
        if (!cancelled) setCatalog(result);
      });
    return () => { cancelled = true; };
  }, []);

  const loadVariants = variantLoader.current;
  useEffect(() => {
    if (settings) loadConfiguredProjectVariants(settings.effective, loadVariants);
  }, [settings, loadVariants]);

  const change = (role, field, value) => {
    setProject((current) => ({ ...current, [role]: { ...current[role], [field]: value } }));
    setError(null);
    setNotice(null);
  };

  const selectModel = (role, value) => {
    if (!value) return;
    try {
      const [provider, model] = JSON.parse(value);
      if (typeof provider === 'string' && typeof model === 'string') loadVariants(role, provider, model);
    } catch { /* malformed selection does not affect manual settings */ }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload(project)),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `${response.status} ${response.statusText}`);
      setSettings(body);
      setProject(projectValues(body.project));
       setNotice('Project model settings saved and managed profiles refreshed. Existing OpenCode session selections are unchanged.');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingError) {
    return (
      <section id="models" aria-label="Models">
        <h2 className="section-title">Models</h2>
        <p className="models-feedback models-feedback--error" role="alert">Unable to load model settings: {loadingError}</p>
      </section>
    );
  }
  if (!settings) return <p className="loading" role="status">loading model settings…</p>;
  return (
    <ModelsForm
      project={project}
      globalSettings={settings.global}
      effective={settings.effective}
      onChange={change}
      onSubmit={submit}
      saving={saving}
      error={error}
      notice={notice}
      catalog={catalog}
      variants={variants}
      onSelectModel={selectModel}
       onRequestVariants={(role) => loadVariants(role, effectiveFieldValue(project, settings.global, role, 'provider'), effectiveFieldValue(project, settings.global, role, 'model'))}
    />
  );
}
