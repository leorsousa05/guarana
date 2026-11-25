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

export function handleTabKeyDown(event, tabIds, onSelect) {
  const key = event.key;
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
  const current = event.target.closest('[data-tab-id]')?.dataset.tabId;
  const index = tabIds.indexOf(current);
  if (index < 0) return;

  event.preventDefault();
  const nextIndex = key === 'Home'
    ? 0
    : key === 'End'
      ? tabIds.length - 1
      : (index + (key === 'ArrowRight' ? 1 : -1) + tabIds.length) % tabIds.length;
  const next = tabIds[nextIndex];
  onSelect(next);
  event.currentTarget.querySelector(`[data-tab-id="${next}"]`)?.focus();
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
