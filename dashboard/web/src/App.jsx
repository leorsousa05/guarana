import { useEffect, useState } from 'react';
import { usePoll } from './hooks/usePoll.js';
import { useLiveTick } from './hooks/useLiveTick.js';
import { Header } from './components/Header.jsx';
import { SectionNav } from './components/SectionNav.jsx';
import { EmptyState, ErrorBanner } from './components/common.jsx';
import { NowPanel } from './components/NowPanel.jsx';
import { Ticker } from './components/Ticker.jsx';
import { Runs } from './components/Runs.jsx';
import { Specs } from './components/Specs.jsx';

export default function App() {
  const liveTick = useLiveTick('/api/telemetry/stream');
  const summary = usePoll('/api/telemetry/summary', 5000, liveTick);
  const state = usePoll('/api/specs/state', 5000, liveTick);
  const tracker = usePoll('/api/specs/tracker', 5000, liveTick);
  const [mergedEvents, setMergedEvents] = useState([]);

  // Fetch events for the ~5 most recent sessions and merge by ts.
  const recentIDs = summary.data ? summary.data.runs.slice(0, 5).map((r) => r.sessionID).join(',') : '';
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
  const hasTelemetry = summary.data && summary.data.runs.length > 0;

  return (
    <main>
      <Header lastEventTs={lastEventTs} tickerTick={mergedEvents.length} />
      <SectionNav />
      {summary.error && <ErrorBanner text={summary.error} />}
      {!summary.data && !summary.error && <p className="loading">loading…</p>}
      {summary.data && (
        <>
          <NowPanel summary={summary.data} mergedEvents={mergedEvents} state={state.data} />
          {hasTelemetry && <Ticker events={mergedEvents} />}
          <Runs summary={summary.data} mergedEvents={mergedEvents} />
        </>
      )}
      <Specs tracker={tracker.data} state={state.data} tick={liveTick} />
    </main>
  );
}
