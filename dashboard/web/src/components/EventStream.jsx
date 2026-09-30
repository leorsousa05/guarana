import { usePoll } from '../hooks/usePoll.js';
import { fmtTime } from '../lib/format.js';
import { Stamp } from './common.jsx';
import { TICKER_KIND } from './Ticker.jsx';

export function EventStream({ sessionID }) {
  const { data } = usePoll(`/api/telemetry/events?session=${encodeURIComponent(sessionID)}`);
  if (!data) return <p className="loading" role="status">loading events…</p>;
  return (
    <div className="events">
      <h3 className="sub-title">event stream — {sessionID}</h3>
      <ul>
        {data.events.map((ev, i) => (
          <li key={i}>
            <span className="ev-ts">{fmtTime(ev.ts)}</span>
            <span className={`ev-kind ev-kind--${ev.type}`}>{TICKER_KIND[ev.type] || ev.type}</span>
            <span className="ev-body">
              {ev.tool && <>{ev.tool} </>}
              {ev.status && <Stamp word={ev.status} />}
              {ev.ok === false && <Stamp word="fail" />}
              {ev.error && <span className="err"> ({ev.error}) </span>}
              {typeof ev.tokens === 'number' && <> tokens={ev.tokens}</>}
              {typeof ev.count === 'number' && <> count={ev.count}</>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
