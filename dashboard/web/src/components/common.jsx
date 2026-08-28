export function EmptyState({ copy, hint }) {
  return (
    <p className="empty-copy">
      {copy}
      {hint && <> <code>{hint}</code></>}
    </p>
  );
}

export function ErrorBanner({ text }) {
  return <p className="error-banner" role="alert">{text}</p>;
}

const GOOD = new Set(['pass', 'shipped', 'ok', 'live', 'done']);
const BAD = new Set(['fail', 'error', 'failed', 'blocked']);

export function Stamp({ word }) {
  const w = String(word || '')
    .replace(/\*\*/g, '')
    .trim();
  if (!w || w.toLowerCase() === 'unknown') return <span>—</span>;
  const cls = BAD.has(w.toLowerCase())
    ? 'stamp stamp--bad'
    : GOOD.has(w.toLowerCase())
      ? 'stamp stamp--good'
      : 'stamp';
  return <span className={cls}>{w.toUpperCase()}</span>;
}
