import { useMemo } from 'react';

export const TICKER_KIND = { tool: '›tool', tokens: '›tokens', session: '›session', todo: '›todo' };

export function tickerLine(ev) {
  const parts = [];
  if (ev.sessionID) parts.push(ev.sessionID);
  if (ev.tool) parts.push(ev.tool);
  if (ev.status) parts.push(ev.status);
  if (ev.ok === false) parts.push('FAILED');
  if (ev.error) parts.push(`(${ev.error})`);
  if (typeof ev.tokens === 'number') parts.push(`tokens=${ev.tokens}`);
  if (typeof ev.count === 'number') parts.push(`count=${ev.count}`);
  return parts.join(' ');
}

export function Ticker({ events }) {
  const items = useMemo(
    () => [...events].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0)).slice(-40),
    [events]
  );
  if (items.length === 0) return null;
  const tape = items.map((ev, i) => (
    <span key={i} className={`tick tick--${ev.type} ${ev.ok === false || ev.status === 'error' ? 'tick--err' : ''}`}>
      <b>{TICKER_KIND[ev.type] || `›${ev.type}`}</b> {tickerLine(ev)}
    </span>
  ));
  return (
    <div className="ticker" aria-label="Live telemetry ticker">
      <div className="ticker-tape">
        {tape}
        {tape}
      </div>
    </div>
  );
}
