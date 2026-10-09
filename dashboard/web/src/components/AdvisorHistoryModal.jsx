import { useEffect, useRef } from 'react';
import { fmtTs } from '../lib/format.js';

const focusables = (root) => root
  ? [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled)
  : [];

export function AdvisorHistoryModal({ state, onClose }) {
  const boxRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const box = boxRef.current;
    (box?.querySelector('.modal-close') || box)?.focus();
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables(boxRef.current);
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === boxRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={boxRef}
        className="modal advisor-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="advisor-history-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <header className="specs-modal-head">
          <h2 id="advisor-history-title">Advisor history</h2>
          <button type="button" className="modal-close" onClick={onClose}>close</button>
        </header>
        <div className="modal-body">
          {state.error ? <p className="activity-error" role="alert">Unable to load Advisor history.</p> : null}
          {!state.data && !state.error ? <p className="loading" role="status">Loading Advisor history…</p> : null}
          {state.data && !state.data.history?.length ? <p role="status">No Advisor calls observed.</p> : null}
          {!!state.data?.history?.length && (
            <ol className="advisor-history-list">
              {state.data.history.map((row, index) => (
                <li key={row.callID || row.childSessionID || `${row.ts}-${index}`}>
                  <div className="advisor-history-row-head">
                    <time dateTime={row.ts ? new Date(row.ts).toISOString() : undefined}>{fmtTs(row.ts)}</time>
                    <span className={`activity-status activity-status--${row.status}`}>{row.status}</span>
                  </div>
                  <dl className="activity-meta-grid">
                    <div><dt>child</dt><dd>{row.childSessionID || 'not reported'}</dd></div>
                    <div><dt>Why Advisor was called</dt><dd>{row.reason || 'Reason not recorded'}</dd></div>
                    {row.parentSessionID && <div><dt>parent</dt><dd>{row.parentSessionID}</dd></div>}
                    {row.callID && <div><dt>call</dt><dd>{row.callID}</dd></div>}
                    <div><dt>observed model</dt><dd>{[row.providerID, row.modelID, row.variant].filter(Boolean).join(' / ') || 'not reported'}</dd></div>
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
