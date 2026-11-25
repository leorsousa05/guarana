export const fmtTs = (ts) => (ts == null ? '—' : new Date(ts).toLocaleString());
export const fmtTime = (ts) => (ts == null ? '—' : new Date(ts).toLocaleTimeString());
export const fmtDur = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);
export const fmtAge = (ts) => {
  if (ts == null) return 'no events';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};
