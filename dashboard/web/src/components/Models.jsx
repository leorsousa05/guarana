import { useEffect, useState } from 'react';

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
    const section = Object.fromEntries(Object.entries(values).filter(([field, value]) => field === 'enabled' ? typeof value === 'boolean' : value !== ''));
    if (Object.keys(section).length) settings[role] = section;
  }
  return { settings };
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

function catalogMessage(catalog, models) {
  if (catalog?.status === 'loading') return 'Checking the OpenCode catalog. Provider and model IDs remain editable below.';
  if (catalog?.status === 'error') return 'OpenCode catalog unavailable. Enter provider and model IDs manually below.';
  if (models.length === 0) return 'No connected OpenCode models found. Enter provider and model IDs manually below.';
  const providers = [...new Set(models.map(({ provider }) => provider.id))];
  return `Connected OpenCode providers: ${providers.join(', ')}. Select a model to fill the provider and model fields.`;
}

function optionId(role, field, index) {
  return `model-${role}-${field}-option-${index}`;
}

export function ModelsForm({
  project,
  sources,
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
  const connectedProviders = filterCatalogProviders(models, '');
  return (
    <section id="models" aria-label="Models">
      <h2 className="section-title">Models</h2>
      <p className="models-intro">Primary supplies agent/profile defaults only; explicit or remembered OpenCode session model/variant selections prevail. Advisor consultations are optional. Credentials stay in OpenCode; project choices override global settings.</p>
      <p id="models-catalog-status" className="models-catalog-status" role="status" aria-live="polite">{message}</p>
      <form className="models-form" onSubmit={onSubmit}>
        <div className="models-roles">{ROLES.map(([role, title]) => {
          const provider = project?.[role]?.provider || '';
          const providerOptions = filterCatalogProviders(models, providerSearches[role]);
          const filteredModels = filterCatalogModels(models.filter((entry) => !provider || entry.provider.id === provider), searches[role]);
          const variantState = variants[role] || { status: 'idle', values: [] };
          const currentVariant = project?.[role]?.variant || '';
          const variantValues = [...new Set(variantState.values || [])];
          const providerOpen = active[`${role}-provider`] !== undefined;
          const modelOpen = active[`${role}-model`] !== undefined;
          const matchingVariants = variantValues.filter((value) => value.toLowerCase().includes(currentVariant.toLowerCase()));
          const variantMessage = variantState.status === 'loading'
            ? 'Loading suggestions… Manual entry works; blank uses the model default.'
            : variantOpen[role]
            ? `${matchingVariants.length ? `${matchingVariants.length} variant suggestion${matchingVariants.length === 1 ? '' : 's'} found.` : 'No variant suggestions match. Your manually typed value will be kept.'}${variantState.status === 'error' ? ' Suggestions unavailable; blank uses the model default.' : !matchingVariants.length ? ' Blank uses the model default.' : ''}`
            : variantState.status === 'error'
              ? 'Suggestions unavailable. Manual entry works; blank uses the model default.'
              : variantState.status === 'ready'
                ? `${variantValues.length} variant suggestion${variantValues.length === 1 ? '' : 's'} available; blank uses the model default.`
                : 'Choose a model to load variant suggestions.';
          return (
            <fieldset className="models-section" key={role}>
              <legend>{role === 'primary' ? 'Primary' : 'Advisor'}</legend>
              <p className="models-role-description">{role === 'primary' ? 'Default model and variant for the Guarana agent in this scope, not a session override.' : 'Optional second opinion when work is blocked.'}</p>
              {role === 'advisor' && (() => {
                const enabledSource = sources?.advisor?.enabled || 'unset';
                const enabled = enabledSource === 'project' ? project?.advisor?.enabled === true : enabledSource === 'global' ? effective?.advisor?.enabled === true : false;
                const configured = Boolean(effective?.advisor?.provider && effective?.advisor?.model);
                return <div className="models-advisor-toggle">
                  <label><input type="checkbox" aria-label="Advisor consultations" checked={enabled} disabled={!enabled && !configured} onChange={(event) => onChange('advisor', 'enabled', event.target.checked)} /> Advisor consultations</label>
                  <small className={`models-source models-source--${enabledSource}`}>{enabledSource === 'project' ? 'Project override' : enabledSource === 'global' ? `Using global setting: ${enabled ? 'on' : 'off'}` : 'Default: off'}</small>
                  {enabledSource === 'project' && <button type="button" className="models-inherit" onClick={() => onChange('advisor', 'enabled', undefined)}>Use global setting</button>}
                </div>;
              })()}
              <div className="models-discovery">
                <div className="models-catalog-field">
                <label htmlFor={`model-${role}-provider-search`}>Provider</label>
                <input id={`model-${role}-provider-search`} type="search" role="combobox" aria-label={`${title} provider search`} aria-expanded={providerOpen} aria-controls={providerOpen ? `model-${role}-providers` : undefined} aria-activedescendant={active[`${role}-provider`] >= 0 ? optionId(role, 'provider', active[`${role}-provider`]) : undefined} aria-autocomplete="list" value={providerSearches[role]} placeholder="Search provider name or ID" onFocus={() => setActive((a) => ({ ...a, [`${role}-provider`]: -1 }))} onChange={(event) => { const value = event.target.value; setProviderSearches((s) => ({ ...s, [role]: value })); applyProviderSelection(role, value, onChange); setActive((a) => ({ ...a, [`${role}-provider`]: -1 })); }} onKeyDown={(event) => { const action = comboboxKeyAction(event.key, active[`${role}-provider`] ?? -1, providerOptions.length); if (!action) return; event.preventDefault(); if (action.close) setActive((a) => { const next = { ...a }; delete next[`${role}-provider`]; return next; }); else if (action.select !== undefined) { const option = providerOptions[action.select]; setProviderSearches((s) => ({ ...s, [role]: option.id })); applyProviderSelection(role, option.id, onChange); setActive((a) => ({ ...a, [`${role}-provider`]: undefined })); } else setActive((a) => ({ ...a, [`${role}-provider`]: action.activeIndex })); }} />
                {active[`${role}-provider`] !== undefined && <ul id={`model-${role}-providers`} className="models-options" role="listbox">{providerOptions.map((option, index) => <li key={option.id}><button id={optionId(role, 'provider', index)} type="button" role="option" aria-selected={active[`${role}-provider`] === index} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => { setProviderSearches((s) => ({ ...s, [role]: option.id })); applyProviderSelection(role, option.id, onChange); setActive((a) => ({ ...a, [`${role}-provider`]: undefined })); }}>{option.name || option.id} <small>{option.id}</small></button></li>)}</ul>}
                  {providerOpen && <small className="models-result-count" role="status" aria-live="polite">{providerOptions.length ? `${providerOptions.length} connected provider${providerOptions.length === 1 ? '' : 's'} found.` : 'No connected match. You can enter a provider ID.'}</small>}
                  {!providerOpen && <small className="models-field-hint">{connectedProviders.length} connected · Search by name or ID; custom IDs work</small>}
                </div>
                <div className="models-catalog-field">
                <label htmlFor={`model-${role}-search`}>Model</label>
                <input id={`model-${role}-search`} role="combobox" aria-label={`${title} model search`} aria-expanded={modelOpen} aria-controls={modelOpen ? `model-${role}-options` : undefined} aria-activedescendant={active[`${role}-model`] >= 0 ? optionId(role, 'model', active[`${role}-model`]) : undefined} aria-autocomplete="list" type="search" value={searches[role] || project?.[role]?.model || ''} placeholder="Search model name or ID" onFocus={() => setActive((a) => ({ ...a, [`${role}-model`]: -1 }))} onChange={(event) => { const value = event.target.value; setSearches((s) => ({ ...s, [role]: value })); onChange(role, 'model', value); onChange(role, 'variant', ''); setActive((a) => ({ ...a, [`${role}-model`]: -1 })); }} onKeyDown={(event) => { const action = comboboxKeyAction(event.key, active[`${role}-model`] ?? -1, filteredModels.length); if (!action) return; event.preventDefault(); if (action.close) setActive((a) => { const next = { ...a }; delete next[`${role}-model`]; return next; }); else if (action.select !== undefined) { const entry = filteredModels[action.select]; const value = modelChoiceValue(entry); applyCatalogSelection(role, value, onChange); onChange(role, 'variant', ''); onSelectModel(role, value); setSearches((s) => ({ ...s, [role]: entry.model.id })); setActive((a) => ({ ...a, [`${role}-model`]: undefined })); } else setActive((a) => ({ ...a, [`${role}-model`]: action.activeIndex })); }} />
                {active[`${role}-model`] !== undefined && <ul id={`model-${role}-options`} className="models-options" role="listbox">{filteredModels.map((entry, index) => <li key={modelChoiceValue(entry)}><button id={optionId(role, 'model', index)} type="button" role="option" aria-selected={active[`${role}-model`] === index} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => { const value = modelChoiceValue(entry); applyCatalogSelection(role, value, onChange); onChange(role, 'variant', ''); onSelectModel(role, value); setSearches((s) => ({ ...s, [role]: entry.model.id })); setActive((a) => ({ ...a, [`${role}-model`]: undefined })); }}>{entry.model.name || entry.model.id} <small>{entry.model.id}</small></button></li>)}</ul>}
                  {modelOpen && <small className="models-result-count" role="status" aria-live="polite">{filteredModels.length ? `${filteredModels.length} model${filteredModels.length === 1 ? '' : 's'} found${provider ? ` for ${provider}` : ''}.` : 'No catalog match. You can enter a model ID.'}</small>}
                  {!modelOpen && <small className="models-field-hint">{provider ? `${provider} catalog · Search model name or ID` : 'Search model name or ID; choose a provider to narrow results'}</small>}
                </div>
              </div>
              <div className="models-fields">
                {FIELDS.map(([field]) => {
                  if (field !== 'variant') return null;
                  const id = `model-${role}-${field}`;
                  const source = sources?.[role]?.[field] || 'unset';
                  const resolved = effective?.[role]?.[field];
                  return (
                    <div className="models-field" key={field}>
                      <label htmlFor={id}>Model variant</label>
                      {field === 'variant' ? <>
                      <input id={id} name={`${role}.${field}`} type="text" autoComplete="off" role="combobox" aria-expanded={!!variantOpen[role]} aria-controls={variantOpen[role] ? `${id}-suggestions` : undefined} aria-activedescendant={variantActive[role] >= 0 ? `${id}-option-${variantActive[role]}` : undefined} aria-autocomplete="list" value={currentVariant} placeholder="Search or type a variant" onFocus={() => { setVariantOpen((state) => ({ ...state, [role]: true })); setVariantActive((state) => ({ ...state, [role]: -1 })); }} onBlur={() => { setVariantOpen((state) => ({ ...state, [role]: false })); setVariantActive((state) => ({ ...state, [role]: -1 })); }} onChange={(event) => { onChange(role, 'variant', event.target.value); setVariantOpen((state) => ({ ...state, [role]: true })); setVariantActive((state) => ({ ...state, [role]: -1 })); }} onKeyDown={(event) => { const index = variantActive[role] ?? -1; let next; if (event.key === 'ArrowDown') next = matchingVariants.length ? (index + 1) % matchingVariants.length : -1; else if (event.key === 'ArrowUp') next = matchingVariants.length ? (index < 0 ? matchingVariants.length - 1 : (index - 1 + matchingVariants.length) % matchingVariants.length) : -1; else if (event.key === 'Escape') { event.preventDefault(); setVariantOpen((state) => ({ ...state, [role]: false })); setVariantActive((state) => ({ ...state, [role]: -1 })); return; } else if (event.key === 'Enter' && index >= 0 && index < matchingVariants.length) { event.preventDefault(); onChange(role, 'variant', matchingVariants[index]); setVariantOpen((state) => ({ ...state, [role]: false })); setVariantActive((state) => ({ ...state, [role]: -1 })); return; } else return; event.preventDefault(); setVariantOpen((state) => ({ ...state, [role]: true })); setVariantActive((state) => ({ ...state, [role]: next })); }} aria-label={`${title} variant`} aria-describedby={`${id}-source ${id}-status`} />
                      {variantOpen[role] && <ul id={`${id}-suggestions`} className="models-options models-variant-options" role="listbox">{matchingVariants.map((variant, index) => <li key={variant}><button id={`${id}-option-${index}`} type="button" role="option" aria-selected={variantActive[role] === index} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(role, 'variant', variant); setVariantOpen((state) => ({ ...state, [role]: false })); setVariantActive((state) => ({ ...state, [role]: -1 })); }}>{variant}</button></li>)}</ul>}
                      <div className="models-variant-meta">
                        <button type="button" className="models-lookup" onClick={() => onRequestVariants(role)} disabled={!project?.[role]?.provider || !project?.[role]?.model}>{variantState.status === 'ready' ? 'Refresh suggestions' : 'Load suggestions'}</button>
                        <small id={`${id}-status`} className="models-variant-status" role="status" aria-live="polite">{variantMessage}</small>
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
                      <small id={`${id}-source`} className={`models-source models-source--${source}`}>{source === 'project' ? 'Project override' : source === 'global' ? `Using global fallback: ${resolved}` : 'Not configured'}</small>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}</div>
        {error && <p className="models-feedback models-feedback--error" role="alert">{error}</p>}
        {notice && <p className="models-feedback models-feedback--success" role="status">{notice}</p>}
        <button className="models-save" type="submit" disabled={saving}>
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
        if (!response.ok || body?.error || !Array.isArray(body?.models)) {
          return { status: 'error', models: [] };
        }
        const models = validCatalogModels(body.models);
        return { status: models.length ? 'ready' : 'empty', models };
      })
      .catch(() => ({ status: 'error', models: [] }))
      .then((result) => {
        if (!cancelled) setCatalog(result);
      });
    return () => { cancelled = true; };
  }, []);

  const change = (role, field, value) => {
    setProject((current) => ({ ...current, [role]: { ...current[role], [field]: value } }));
    setError(null);
    setNotice(null);
  };

  const loadVariants = async (role, provider = project[role]?.provider, model = project[role]?.model) => {
    if (!provider || !model) return;
    setVariants((current) => ({ ...current, [role]: { status: 'loading', values: [] } }));
    try {
      const query = new URLSearchParams({ provider, model });
      const response = await fetch(`/api/models/variants?${query}`);
      const body = await response.json();
      if (!response.ok || !Array.isArray(body?.variants)) throw new Error();
      setVariants((current) => ({ ...current, [role]: { status: 'ready', values: body.variants.filter((value) => typeof value === 'string') } }));
    } catch {
      setVariants((current) => ({ ...current, [role]: { status: 'error', values: [] } }));
    }
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
      setNotice('Project model settings saved; managed profiles refreshed.');
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
      sources={settings.sources}
      effective={settings.effective}
      onChange={change}
      onSubmit={submit}
      saving={saving}
      error={error}
      notice={notice}
      catalog={catalog}
      variants={variants}
      onSelectModel={selectModel}
      onRequestVariants={loadVariants}
    />
  );
}
