import { useEffect, useLayoutEffect, useRef } from 'react';

const focusables = (root) => root
  ? [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled)
  : [];

const useFocusLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function restoreFocus(trigger) {
  if (!trigger) return;
  requestAnimationFrame(() => {
    if (trigger.isConnected) trigger.focus();
  });
}

export function CompletedSubagentsModal({ rows, totalCount, triggerRef, onSelectSession, onClose }) {
  const boxRef = useRef(null);
  const recentRows = (Array.isArray(rows) ? rows : []).slice(0, 20);

  useFocusLayoutEffect(() => {
    (boxRef.current?.querySelector('.modal-close') || boxRef.current)?.focus();
  }, []);

  const close = () => {
    const trigger = triggerRef?.current;
    onClose();
    restoreFocus(trigger);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables(boxRef.current);
    if (!items.length) {
      event.preventDefault();
      boxRef.current?.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !boxRef.current?.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !boxRef.current?.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  };

  return <div className="modal-backdrop" onClick={(event) => {
    if (event.target === event.currentTarget) close();
  }}>
    <section
      id="completed-subagents-dialog"
      ref={boxRef}
      className="modal modal--specs completed-subagents-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completed-subagents-title"
      aria-describedby="completed-subagents-description"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <header className="specs-modal-head">
        <div>
          <h2 id="completed-subagents-title">Completed subagent history</h2>
          <p id="completed-subagents-description">{totalCount} completed or terminal subagents, newest observed first.</p>
        </div>
        <button type="button" className="modal-close" onClick={close}>close</button>
      </header>
      <div className="modal-body specs-modal-body">
        {totalCount > recentRows.length && <p className="activity-completed-limit">Showing the 20 most recently observed.</p>}
        {!recentRows.length && <p role="status">No completed subagents observed.</p>}
        {!!recentRows.length && <ul className="activity-agent-list completed-subagents-list" aria-label="Completed subagents">
          {recentRows.map((row) => <li key={row.sessionID} className="activity-agent-node">
            <button
              type="button"
              className={`activity-agent-button${row.selected ? ' activity-agent-button--selected' : ''}`}
              aria-pressed={row.selected}
              onClick={() => {
                onSelectSession(row.sessionID);
                close();
              }}
            >
              <span className="activity-agent-name">{row.agent} · <code>{row.sessionID}</code></span>
              <span className={`activity-status activity-status--${row.status}`}>{row.status}</span>
              <span className="activity-agent-activity">{row.activity}</span>
              <span className="activity-agent-time">Started · {row.started} · elapsed {row.elapsed}</span>
              <span className="activity-agent-time">{row.terminalTime}</span>
            </button>
          </li>)}
        </ul>}
      </div>
    </section>
  </div>;
}
