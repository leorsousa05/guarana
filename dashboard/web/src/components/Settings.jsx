import { useEffect, useState } from 'react';
import { Models } from './Models.jsx';
import { useProjectFetch } from '../lib/projectApi.js';

const WEB_DEFAULTS = {
  appearance: { theme: 'light', startPage: 'overview' },
  refresh: { intervalSeconds: 5 },
  server: { port: 4200, open: true },
};
const WEB_FIELDS = [
  { section: 'appearance', field: 'theme', label: 'Theme', kind: 'select', options: [['light', 'Light'], ['dark', 'Dark']] },
  { section: 'appearance', field: 'startPage', label: 'Start page', kind: 'select', options: [['overview', 'Overview'], ['now', 'Activity'], ['runs', 'Runs'], ['specs', 'Specs'], ['workflow', 'Workflow'], ['memory', 'Memory'], ['skills', 'Skills'], ['settings', 'Settings']] },
  { section: 'refresh', field: 'intervalSeconds', label: 'Live refresh interval', kind: 'select', options: [[5, '5 seconds'], [15, '15 seconds'], [30, '30 seconds']] },
  { section: 'server', field: 'port', label: 'Server port', kind: 'number' },
  { section: 'server', field: 'open', label: 'Open dashboard on start', kind: 'checkbox' },
];
const WORKFLOW_FIELDS = [
  { name: 'specs', label: 'Specs + worker-specs' },
  { name: 'verify', label: 'Independent verification' },
];
const PREFERENCE_BUDGET_FIELD = 'preferenceInjectionBudgetTokens';

function copySettings(settings) {
  return Object.fromEntries(Object.entries(settings || {}).map(([key, value]) => [key, { ...value }]));
}

function useLatestSettings(current, incoming, setCurrent) {
  useEffect(() => {
    if (incoming && JSON.stringify(current) !== JSON.stringify(incoming)) setCurrent(incoming);
  }, [current, incoming, setCurrent]);
}

export function setWebField(settings, section, field, value) {
  return { ...settings, [section]: { ...(settings?.[section] || {}), [field]: value } };
}

export function clearWebField(settings, section, field) {
  const next = copySettings(settings);
  if (next[section]) {
    delete next[section][field];
    if (!Object.keys(next[section]).length) delete next[section];
  }
  return next;
}

export function setWorkflowField(settings, name, enabled) {
  return { ...settings, [name]: { ...(settings?.[name] || {}), enabled } };
}

export function workflowFieldUpdate(name, event) {
  const enabled = event.currentTarget.checked;
  return (current) => setWorkflowField(current, name, enabled);
}

export function clearWorkflowField(settings, name) {
  const next = copySettings(settings);
  delete next[name];
  return next;
}

export function setWorkflowBudgetField(settings, value) {
  const next = copySettings(settings);
  if (value === '') {
    if (next.memory) {
      delete next.memory[PREFERENCE_BUDGET_FIELD];
      if (!Object.keys(next.memory).length) delete next.memory;
    }
  } else {
    next.memory = { ...(next.memory || {}), [PREFERENCE_BUDGET_FIELD]: value };
  }
  return next;
}

export function clearWorkflowBudgetField(settings) {
  return setWorkflowBudgetField(settings, '');
}

export async function putScopedSettings(endpoint, scope, settings, request = fetch) {
  const response = await request(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, settings }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || `${response.status} ${response.statusText}`);
  return body;
}

function sourceLabel(source) {
  return source === 'project' ? 'Project' : source === 'global' ? 'Global' : 'Default';
}

function editingCopy(scope) {
  return scope === 'global'
    ? 'Editing Global affects every project unless that project has its own override.'
    : 'Editing Project changes this checkout only. Unset fields inherit Global, then the built-in default.';
}

function fieldValue(scope, draft, global, section, field, fallback) {
  if (Object.hasOwn(draft?.[section] || {}, field)) return draft[section][field];
  if (scope === 'project' && Object.hasOwn(global?.[section] || {}, field)) return global[section][field];
  return fallback;
}

function workflowValue(scope, draft, global, name) {
  if (Object.hasOwn(draft?.[name] || {}, 'enabled')) return draft[name].enabled;
  if (scope === 'project' && Object.hasOwn(global?.[name] || {}, 'enabled')) return global[name].enabled;
  return true;
}

function workflowBudgetValue(scope, draft, global) {
  if (Object.hasOwn(draft?.memory || {}, PREFERENCE_BUDGET_FIELD)) return draft.memory[PREFERENCE_BUDGET_FIELD];
  if (scope === 'project' && Object.hasOwn(global?.memory || {}, PREFERENCE_BUDGET_FIELD)) {
    return global.memory[PREFERENCE_BUDGET_FIELD];
  }
  return '';
}

function webValueLabel(field, value) {
  if (field === 'theme') return value === 'dark' ? 'Dark' : 'Light';
  if (field === 'startPage') return value === 'now' ? 'Activity' : `${String(value).charAt(0).toUpperCase()}${String(value).slice(1)}`;
  if (field === 'intervalSeconds') return `${value} seconds`;
  if (field === 'open') return value ? 'enabled' : 'disabled';
  return value;
}

function ScopePicker({ name, value, onChange }) {
  return (
    <label className="settings-scope-picker">
      <span>{name}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        <option value="project">Project</option>
        <option value="global">Global</option>
      </select>
    </label>
  );
}

export function Settings({
  webSettings,
  webSettingsError,
  onWebSettingsUpdated,
  workflowSettings,
  workflowSettingsError,
  refreshWorkflowSettings,
}) {
  const projectFetch = useProjectFetch();
  const [webState, setWebState] = useState(webSettings || null);
  const [workflowState, setWorkflowState] = useState(workflowSettings || null);
  const [webScope, setWebScope] = useState('project');
  const [workflowScope, setWorkflowScope] = useState('project');
  const [webDraft, setWebDraft] = useState(() => copySettings(webSettings?.project));
  const [workflowDraft, setWorkflowDraft] = useState(() => copySettings(workflowSettings?.project));
  const [webSaving, setWebSaving] = useState(false);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [webFeedback, setWebFeedback] = useState(null);
  const [workflowFeedback, setWorkflowFeedback] = useState(null);

  useLatestSettings(webState, webSettings, setWebState);
  useLatestSettings(workflowState, workflowSettings, setWorkflowState);
  useEffect(() => setWebDraft(copySettings(webState?.[webScope])), [webState, webScope]);
  useEffect(() => setWorkflowDraft(copySettings(workflowState?.[workflowScope])), [workflowState, workflowScope]);

  const saveWeb = async (scope = webScope, next = webDraft) => {
    setWebSaving(true);
    setWebFeedback(null);
    try {
      const result = await putScopedSettings('/api/web/settings', scope, next, projectFetch);
      setWebState(result);
      onWebSettingsUpdated?.(result);
      setWebFeedback({ type: 'success', text: `${sourceLabel(scope)} web settings saved.` });
    } catch (error) {
      setWebFeedback({ type: 'error', text: `Unable to save web settings: ${error.message}` });
    } finally {
      setWebSaving(false);
    }
  };

  const saveWorkflow = async (scope = workflowScope, next = workflowDraft) => {
    setWorkflowSaving(true);
    setWorkflowFeedback(null);
    try {
      const result = await putScopedSettings('/api/workflow/settings', scope, next, projectFetch);
      setWorkflowState(result);
      refreshWorkflowSettings?.();
      setWorkflowFeedback({ type: 'success', text: `${sourceLabel(scope)} workflow preferences saved.` });
    } catch (error) {
      setWorkflowFeedback({ type: 'error', text: `Unable to save workflow preferences: ${error.message}` });
    } finally {
      setWorkflowSaving(false);
    }
  };

  const settings = webState || webSettings;
  const workflow = workflowState || workflowSettings;
  return (
    <section className="settings-page" aria-label="Settings">
      <h2 className="section-title">Settings</h2>
      <p className="settings-intro">Project model defaults, workflow automation, and dashboard preferences.</p>

      <Models />

      <section className="settings-section" aria-labelledby="settings-workflow-title">
        <div className="settings-section-head">
          <div>
            <p className="settings-kicker">Automation</p>
            <h3 id="settings-workflow-title">Workflow preferences</h3>
          </div>
          <ScopePicker name="Workflow preference scope" value={workflowScope} onChange={setWorkflowScope} />
        </div>
        <p className="settings-scope-copy">{editingCopy(workflowScope)}</p>
        {workflow ? (
          <fieldset className="settings-fields" disabled={workflowSaving}>
            <legend className="settings-legend">Effective behavior</legend>
            {WORKFLOW_FIELDS.map(({ name, label }) => {
              const effective = workflow.effective?.[name]?.enabled !== false;
              const value = workflowValue(workflowScope, workflowDraft, workflow.global, name);
              const source = workflow.sources?.[name] || 'default';
              const canClear = workflowScope === 'project' && Object.hasOwn(workflowDraft?.[name] || {}, 'enabled');
              return (
                <div className="settings-row" key={name}>
                  <label className="settings-toggle" htmlFor={`settings-workflow-${name}`}>
                    <span>{label}</span>
                    <input
                      id={`settings-workflow-${name}`}
                      type="checkbox"
                      checked={value}
                      aria-describedby={`settings-workflow-source-${name}`}
                      onChange={(event) => setWorkflowDraft(workflowFieldUpdate(name, event))}
                    />
                  </label>
                  <p className="settings-source" id={`settings-workflow-source-${name}`}>
                    Effective: {effective ? 'enabled' : 'disabled'} · Source: {sourceLabel(source)}
                  </p>
                  {canClear && <button className="settings-clear" type="button" aria-label={`Clear project override for ${label}`} onClick={() => {
                    const next = clearWorkflowField(workflowDraft, name);
                    setWorkflowDraft(next);
                    saveWorkflow('project', next);
                  }}>Clear project override</button>}
                </div>
              );
            })}
            {(() => {
              const field = PREFERENCE_BUDGET_FIELD;
              const id = `settings-workflow-memory-${field}`;
              const effective = workflow.effective?.memory?.[field];
              const source = workflow.sources?.memory?.[field] || 'default';
              const value = workflowBudgetValue(workflowScope, workflowDraft, workflow.global);
              const canClear = workflowScope === 'project' && Object.hasOwn(workflowDraft?.memory || {}, field);
              return (
                <div className="settings-row" key={id}>
                  <label className="settings-control" htmlFor={id}>
                    <span>Global preference injection budget (tokens)</span>
                    <input
                      id={id}
                      type="number"
                      min="1"
                      step="1"
                      value={value}
                      aria-describedby={`${id}-source settings-workflow-budget-note`}
                      onChange={(event) => setWorkflowDraft((current) => setWorkflowBudgetField(
                        current,
                        event.currentTarget.value === '' ? '' : Number(event.currentTarget.value),
                      ))}
                    />
                  </label>
                  <p className="settings-source" id={`${id}-source`}>
                    Effective: {effective == null ? 'model context when available' : `${effective} tokens`} · Source: {sourceLabel(source)}
                  </p>
                  {canClear && <button className="settings-clear" type="button" aria-label="Clear project override for preference injection budget" onClick={() => {
                    const next = clearWorkflowBudgetField(workflowDraft);
                    setWorkflowDraft(next);
                    saveWorkflow('project', next);
                  }}>Clear project override</button>}
                </div>
              );
            })()}
          </fieldset>
        ) : (
          <p className="settings-loading" role={workflowSettingsError ? 'alert' : 'status'}>
            {workflowSettingsError ? `Unable to load workflow preferences: ${workflowSettingsError}` : 'Loading workflow preferences…'}
          </p>
        )}
        <p className="settings-scope-note" id="settings-workflow-budget-note">
          The complete preference set is injected or omitted as a whole. UTF-8 serialized byte length is compared with the token budget as an estimate, not exact tokenization or remaining conversation capacity. When unset, model context is used.
        </p>
        {workflowSettingsError && workflow && <p className="settings-feedback settings-feedback--error" role="alert">Unable to refresh workflow preferences: {workflowSettingsError}</p>}
        {workflowFeedback && <p className={`settings-feedback settings-feedback--${workflowFeedback.type}`} role={workflowFeedback.type === 'error' ? 'alert' : 'status'}>{workflowFeedback.text}</p>}
        {workflow && <button className="settings-save" type="button" disabled={workflowSaving} onClick={() => saveWorkflow()}>{workflowSaving ? 'Saving…' : `Save ${sourceLabel(workflowScope)} workflow preferences`}</button>}
      </section>

      <section className="settings-section" aria-labelledby="settings-web-title">
        <div className="settings-section-head">
          <div>
            <p className="settings-kicker">Dashboard</p>
            <h3 id="settings-web-title">Web preferences</h3>
          </div>
          <ScopePicker name="Web preference scope" value={webScope} onChange={setWebScope} />
        </div>
        <p className="settings-scope-copy">{editingCopy(webScope)}</p>
        {settings ? (
          <fieldset className="settings-fields" disabled={webSaving}>
            <legend className="settings-legend">Effective preferences</legend>
            {WEB_FIELDS.map(({ section, field, label, kind, options }) => {
              const id = `settings-web-${section}-${field}`;
              const effective = settings.effective?.[section]?.[field] ?? WEB_DEFAULTS[section][field];
              const source = settings.sources?.[section]?.[field] || 'default';
              const value = fieldValue(webScope, webDraft, settings.global, section, field, WEB_DEFAULTS[section][field]);
              const canClear = webScope === 'project' && Object.hasOwn(webDraft?.[section] || {}, field);
              const update = (newValue) => setWebDraft((current) => setWebField(current, section, field, newValue));
              return (
                <div className={`settings-row${kind === 'checkbox' ? ' settings-row--toggle' : ''}`} key={`${section}.${field}`}>
                  <label className={kind === 'checkbox' ? 'settings-toggle' : 'settings-control'} htmlFor={id}>
                    <span>{label}</span>
                    {kind === 'select' ? (
                      <select id={id} value={value} aria-describedby={`${id}-source`} onChange={(event) => update(field === 'intervalSeconds' ? Number(event.currentTarget.value) : event.currentTarget.value)}>
                        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
                      </select>
                    ) : kind === 'number' ? (
                      <input id={id} type="number" min="1" max="65535" step="1" value={value} aria-describedby={`${id}-source settings-server-note`} onChange={(event) => update(event.currentTarget.value === '' ? '' : Number(event.currentTarget.value))} />
                    ) : (
                      <input id={id} type="checkbox" checked={value} aria-describedby={`${id}-source settings-server-note`} onChange={(event) => update(event.currentTarget.checked)} />
                    )}
                  </label>
                  <p className="settings-source" id={`${id}-source`}>
                    Effective: {webValueLabel(field, effective)} · Source: {sourceLabel(source)}
                  </p>
                  {canClear && <button className="settings-clear" type="button" aria-label={`Clear project override for ${label}`} onClick={() => {
                    const next = clearWebField(webDraft, section, field);
                    setWebDraft(next);
                    saveWeb('project', next);
                  }}>Clear project override</button>}
                </div>
              );
            })}
          </fieldset>
        ) : (
          <p className="settings-loading" role={webSettingsError ? 'alert' : 'status'}>
            {webSettingsError ? `Unable to load web preferences: ${webSettingsError}` : 'Loading web preferences…'}
          </p>
        )}
        <p className="settings-scope-note" id="settings-server-note">Server port and auto-open changes apply on the next guarana web invocation.</p>
        {webSettingsError && settings && <p className="settings-feedback settings-feedback--error" role="alert">Unable to refresh web preferences: {webSettingsError}</p>}
        {webFeedback && <p className={`settings-feedback settings-feedback--${webFeedback.type}`} role={webFeedback.type === 'error' ? 'alert' : 'status'}>{webFeedback.text}</p>}
        {settings && <button className="settings-save" type="button" disabled={webSaving} onClick={() => saveWeb()}>{webSaving ? 'Saving…' : `Save ${sourceLabel(webScope)} web preferences`}</button>}
      </section>
    </section>
  );
}
