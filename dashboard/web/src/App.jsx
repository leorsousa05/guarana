import { useEffect, useState } from 'react';
import { usePoll } from './hooks/usePoll.js';
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
import { Models } from './components/Models.jsx';

const VIEWS = ['overview', 'now', 'runs', 'specs', 'workflow', 'memory', 'skills', 'models'];

// Read the active view from the URL hash (#/runs -> 'runs'), defaulting to
// 'now'. Keeps the selected section deep-linkable and shareable.
export function viewFromHash() {
  const m = window.location.hash.match(/^#\/?([a-z-]+)/);
  return m && VIEWS.includes(m[1]) ? m[1] : 'overview';
}

export default function App() {
  const liveTick = useLiveTick('/api/telemetry/stream');
  const summary = usePoll('/api/telemetry/summary', 5000, liveTick);
  const state = usePoll('/api/specs/state', 5000, liveTick);
  const tracker = usePoll('/api/specs/tracker', 5000, liveTick);
  const workflow = usePoll('/api/workflow/current', 5000, liveTick);
  const [active, setActive] = useState(viewFromHash);
  const [mergedEvents, setMergedEvents] = useState([]);

  // Keep the hash in sync with the active view (no re-navigation on mount).
  useEffect(() => {
    const onHash = () => setActive(viewFromHash());
    window.addEventListener('hashchange', onHash);
    if (window.location.hash !== `#/${active}`) {
      window.history.replaceState(null, '', `#/${active}`);
    }
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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
        const results = await Promise.all(
          ids.map((id) => fetch(`/api/telemetry/events?session=${encodeURIComponent(id)}`).then((r) => r.json()))
        );
        if (cancelled) return;
        const merged = results.flatMap((r) => r.events || []).sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
        setMergedEvents(merged);
      } catch {
        /* keep last good data */
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [recentIDs, liveTick]);

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
          {active === 'models' && <Models />}
        </div>
      </div>
    </main>
  );
}
