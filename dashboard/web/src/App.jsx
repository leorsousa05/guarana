import { useEffect, useRef, useState } from 'react';
import { PollIntervalContext, usePoll } from './hooks/usePoll.js';
import { useLiveTick } from './hooks/useLiveTick.js';
import { Header } from './components/Header.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { ErrorBanner } from './components/common.jsx';
import { Activity, activitySessionIDs } from './components/Activity.jsx';
import { Runs } from './components/Runs.jsx';
import { Specs } from './components/Specs.jsx';
import { Memory } from './components/Memory.jsx';
import { Workflow } from './components/Workflow.jsx';
import { Overview } from './components/Overview.jsx';
import { Skills } from './components/Skills.jsx';
import { Settings } from './components/Settings.jsx';

const VIEWS = ['overview', 'now', 'runs', 'specs', 'workflow', 'memory', 'skills', 'settings'];

// Read a valid deep link first, then use the saved start page when the URL has
// no recognized route. A malformed saved value falls back to Overview.
export function viewFromHash(startPage = 'overview') {
  const m = window.location.hash.match(/^#\/?([a-z-]+)/);
  if (m && VIEWS.includes(m[1])) return m[1];
  return VIEWS.includes(startPage) ? startPage : 'overview';
}

export default function App() {
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
      />
    </PollIntervalContext.Provider>
  );
}

function Dashboard({ webSettings, webSettingsError, onWebSettingsUpdated, pollIntervalMs }) {
  const liveTick = useLiveTick('/api/telemetry/stream');
  const summary = usePoll('/api/telemetry/summary', 5000, liveTick);
  const state = usePoll('/api/specs/state', 5000);
  const tracker = usePoll('/api/specs/tracker', 5000);
  const workflow = usePoll('/api/workflow/current', 5000);
  const workflowSettings = usePoll('/api/workflow/settings', 15000);
  const [active, setActive] = useState(() => viewFromHash());
  const [mergedEvents, setMergedEvents] = useState([]);
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
  useEffect(() => {
    if (!recentIDs) {
      setMergedEvents([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const ids = recentIDs.split(',');
      try {
        const query = ids.map((id) => `session=${encodeURIComponent(id)}`).join('&');
        const result = await fetch(`/api/telemetry/events?${query}`).then((r) => r.json());
        if (cancelled) return;
        const merged = (result.events || []).sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
        setMergedEvents(merged);
      } catch {
        /* keep last good data */
      }
    };
    load();
    const id = setInterval(load, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [recentIDs, pollIntervalMs]);

  const lastEventTs = mergedEvents.length ? mergedEvents[mergedEvents.length - 1].ts : null;
  return (
    <main id="main-content" tabIndex={-1} className="app-main">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header lastEventTs={lastEventTs} tickerTick={mergedEvents.length} />
      <div className="app-shell">
        <Sidebar active={active} onSelect={selectView} />
        <div className="app-content">
          {summary.error && <ErrorBanner text={summary.error} />}
          {!summary.data && !summary.error && <p className="loading" role="status">loading dashboard…</p>}
          {active === 'overview' && (
            <Overview summary={summary.data} state={state.data} tracker={tracker.data} workflow={workflow.data} />
          )}
          {active === 'now' && summary.data && (
            <Activity summary={summary.data} workflow={workflow.data} tick={liveTick} />
          )}
          {active === 'runs' && summary.data && (
            <Runs summary={summary.data} mergedEvents={mergedEvents} />
          )}
          {active === 'specs' && <Specs tracker={tracker.data} state={state.data} tick={liveTick} />}
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
