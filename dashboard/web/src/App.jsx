import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PollIntervalContext, usePoll } from './hooks/usePoll.js';
import { addCurrentProject, ProjectIdContext, readSavedProjectId, removeRegisteredProject, resolveProjectSelection, saveProjectId } from './lib/projectApi.js';
import { Header } from './components/Header.jsx';
import { ProjectSelector } from './components/ProjectSelector.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { ErrorBanner } from './components/common.jsx';
import { Activity, activitySessionIDs } from './components/Activity.jsx';
import { Runs } from './components/Runs.jsx';
import { Specs } from './components/Specs.jsx';
import { Memory } from './components/Memory.jsx';
import { Workflow } from './components/Workflow.jsx';
import { Overview } from './components/Overview.jsx';
import { OperationPulse } from './components/OperationPulse.jsx';
import { Skills } from './components/Skills.jsx';
import { Settings } from './components/Settings.jsx';
import { KnowledgeHome } from './components/KnowledgeHome.jsx';

const VIEWS = ['overview', 'operation', 'now', 'runs', 'knowledge', 'specs', 'workflow', 'memory', 'skills', 'settings'];

// Read a valid deep link first, then use the saved start page when the URL has
// no recognized route. A malformed saved value falls back to Overview.
export function viewFromHash(startPage = 'overview') {
  const m = window.location.hash.match(/^#\/?([a-z-]+)$/);
  if (m && VIEWS.includes(m[1])) return m[1];
  return VIEWS.includes(startPage) ? startPage : 'overview';
}

export default function App() {
  const [projectList, setProjectList] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectNotice, setProjectNotice] = useState(null);
  const [projectBusy, setProjectBusy] = useState(false);

  const reloadProjects = useCallback(async (preferredId, successText = null) => {
    const response = await fetch('/api/projects');
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error || `${response.status} ${response.statusText}`);
    const choice = resolveProjectSelection(body, preferredId);
    setProjectList(body);
    setSelectedProjectId(choice.projectId);
    if (choice.projectId) saveProjectId(choice.projectId);
    setProjectNotice(choice.stale
      ? { type: 'status', text: 'The saved project is no longer available. Showing the current project instead.' }
      : successText ? { type: 'status', text: successText } : null);
    return choice.projectId;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/projects')
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || `${response.status} ${response.statusText}`);
        if (cancelled) return;
        const savedId = readSavedProjectId();
        const choice = resolveProjectSelection(body, savedId);
        setProjectList(body);
        setSelectedProjectId(choice.projectId);
        if (choice.projectId) saveProjectId(choice.projectId);
        if (choice.stale) setProjectNotice({ type: 'status', text: 'The saved project is no longer available. Showing the current project instead.' });
      })
      .catch((error) => {
        if (!cancelled) setProjectNotice({ type: 'error', text: `Unable to load projects: ${error.message}` });
      });
    return () => { cancelled = true; };
  }, []);

  const selectProject = (id) => {
    if (!projectList?.projects.some((project) => project.id === id)) return;
    saveProjectId(id);
    setSelectedProjectId(id);
    setProjectNotice(null);
  };

  const addProject = async () => {
    setProjectBusy(true);
    try {
      const project = await addCurrentProject();
      await reloadProjects(project?.id, 'Current project added to the project list.');
    } catch (error) {
      setProjectNotice({ type: 'error', text: `Unable to add this project: ${error.message}` });
    } finally { setProjectBusy(false); }
  };

  const removeProject = async () => {
    if (!selectedProjectId || !window.confirm('Remove only this project’s registry entry? Project files and settings will remain untouched.')) return;
    setProjectBusy(true);
    try {
      await removeRegisteredProject(selectedProjectId);
      await reloadProjects(selectedProjectId, 'Project registry entry removed. Project files and settings were left untouched.');
    } catch (error) {
      setProjectNotice({ type: 'error', text: `Unable to remove this project: ${error.message}` });
    } finally { setProjectBusy(false); }
  };

  if (!projectList || !selectedProjectId) {
    return <main className="app-main"><p className={projectNotice?.type === 'error' ? 'error-banner' : 'loading'} role={projectNotice?.type === 'error' ? 'alert' : 'status'}>{projectNotice?.text || 'loading projects…'}</p></main>;
  }

  const projectSelector = (
    <ProjectSelector
      projects={projectList.projects}
      selectedProjectId={selectedProjectId}
      notice={projectNotice}
      busy={projectBusy}
      onSelect={selectProject}
      onAdd={addProject}
      onRemove={removeProject}
    />
  );
  return (
    <ProjectIdContext.Provider value={selectedProjectId}>
      <ProjectDashboard
        key={selectedProjectId}
        projectSelector={projectSelector}
      />
    </ProjectIdContext.Provider>
  );
}

function ProjectDashboard({ projectSelector }) {
  const webSettingsPoll = usePoll('/api/web/settings', 15000);
  const [webSettings, setWebSettings] = useState(null);

  useEffect(() => {
    if (webSettingsPoll.data) setWebSettings(webSettingsPoll.data);
  }, [webSettingsPoll.data]);

  useEffect(() => {
    document.documentElement.dataset.theme = webSettings?.effective?.appearance?.theme || 'light';
  }, [webSettings]);

  const pollIntervalMs = (webSettings?.effective?.refresh?.intervalSeconds || 5) * 1000;
  return (
    <PollIntervalContext.Provider value={pollIntervalMs}>
      <Dashboard
        webSettings={webSettings}
        webSettingsError={webSettingsPoll.error}
        onWebSettingsUpdated={setWebSettings}
        pollIntervalMs={pollIntervalMs}
        projectSelector={projectSelector}
      />
    </PollIntervalContext.Provider>
  );
}

function Dashboard({ webSettings, webSettingsError, onWebSettingsUpdated, pollIntervalMs, projectSelector }) {
  const summary = usePoll('/api/telemetry/summary', 5000);
  const state = usePoll('/api/specs/state', 5000);
  const tracker = usePoll('/api/specs/tracker', 5000);
  const workflow = usePoll('/api/workflow/current', 5000);
  const workflowSettings = usePoll('/api/workflow/settings', 15000);
  const [active, setActive] = useState(() => viewFromHash());
  const startupApplied = useRef(false);
  const startPage = webSettings?.effective?.appearance?.startPage || 'overview';
  const startupReady = Boolean(webSettings);

  useEffect(() => {
    const onHash = () => setActive(viewFromHash(startPage));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [startPage]);

  useEffect(() => {
    if (!startupReady || startupApplied.current) return;
    const initialView = viewFromHash(startPage);
    setActive(initialView);
    if (window.location.hash && window.location.hash !== `#/${initialView}`) {
      window.history.replaceState(null, '', `#/${initialView}`);
    }
    startupApplied.current = true;
  }, [startupReady, startPage]);

  const selectView = (id) => {
    setActive(id);
    window.location.hash = `#/${id}`;
    const main = document.getElementById('main-content');
    if (main) main.focus();
  };

  // Fetch events for the ~5 most recent sessions and merge by ts.
  const recentIDs = summary.data ? activitySessionIDs(summary.data).join(',') : '';
  const recentEventsUrl = recentIDs
    ? `/api/telemetry/events?${recentIDs.split(',').map((id) => `session=${encodeURIComponent(id)}`).join('&')}`
    : null;
  const recentEvents = usePoll(recentEventsUrl, pollIntervalMs);
  const mergedEvents = useMemo(
    () => recentIDs
      ? [...(recentEvents.data?.events || [])].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
      : [],
    [recentIDs, recentEvents.data]
  );

  const lastEventTs = mergedEvents.length ? mergedEvents[mergedEvents.length - 1].ts : null;
  return (
    <main id="main-content" tabIndex={-1} className="app-main">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header lastEventTs={lastEventTs} tickerTick={mergedEvents.length} projectSelector={projectSelector} />
      <div className="app-shell">
        <Sidebar active={active} onSelect={selectView} />
        <div className="app-content">
          {!['overview', 'operation', 'knowledge'].includes(active) && summary.error && <ErrorBanner text={summary.error} />}
          {!['overview', 'operation', 'knowledge'].includes(active) && !summary.data && !summary.error && <p className="loading" role="status">loading dashboard…</p>}
          {['overview', 'operation'].includes(active) && (
            <section className="operation-home" aria-labelledby="operation-title">
              <header className="operation-home-head">
                <h1 id="operation-title">Operation</h1>
                <p>Current project state and the signals around active work.</p>
                <nav className="operation-shortcuts" aria-label="Operation destinations">
                  {[
                    ['now', 'Activity'],
                    ['runs', 'Runs'],
                    ['workflow', 'Workflow'],
                  ].map(([route, label]) => (
                    <a key={route} href={`#/${route}`} onClick={(event) => {
                      event.preventDefault();
                      selectView(route);
                    }}>{label}</a>
                  ))}
                </nav>
              </header>
              <OperationPulse
                summary={summary.data}
                summaryError={summary.error}
                summaryLoading={!summary.data && !summary.error}
                events={mergedEvents}
                eventsError={recentEventsUrl ? recentEvents.error : null}
                eventsLoading={Boolean(recentEventsUrl) && !recentEvents.data && !recentEvents.error}
              />
              <Overview
                summary={summary.data}
                summaryError={summary.error}
                summaryLoading={!summary.data && !summary.error}
                state={state.data}
                workflow={workflow.data}
                workflowError={workflow.error}
                workflowLoading={!workflow.data && !workflow.error}
              />
            </section>
          )}
          {active === 'knowledge' && <KnowledgeHome onSelect={selectView} />}
          {active === 'now' && summary.data && (
            <Activity summary={summary.data} workflow={workflow.data} />
          )}
          {active === 'runs' && summary.data && (
            <Runs summary={summary.data} mergedEvents={mergedEvents} />
          )}
          {active === 'specs' && <Specs tracker={tracker.data} state={state.data} />}
          {active === 'workflow' && <Workflow data={workflow.data} />}
          {active === 'memory' && <Memory />}
          {active === 'skills' && <Skills />}
          {active === 'settings' && (
            <Settings
              webSettings={webSettings}
              webSettingsError={webSettingsError}
              onWebSettingsUpdated={onWebSettingsUpdated}
              workflowSettings={workflowSettings.data}
              workflowSettingsError={workflowSettings.error}
              refreshWorkflowSettings={workflowSettings.refetch}
            />
          )}
        </div>
      </div>
    </main>
  );
}
