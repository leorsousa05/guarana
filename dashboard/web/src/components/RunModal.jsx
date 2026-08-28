import { useEffect, useRef } from 'react';
import { EventStream } from './EventStream.jsx';

const modalFocusables = (root) =>
  root
    ? [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
        (el) => !el.disabled
      )
    : [];

export function RunModal({ sessionID, onClose, trigger }) {
  const boxRef = useRef(null);
  useEffect(() => {
    const box = boxRef.current;
    if (box) {
      const els = modalFocusables(box);
      (els[0] || box).focus();
    }
  }, []);
  const handleKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      const box = boxRef.current;
      if (!box) return;
      const els = modalFocusables(box);
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === box)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={boxRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Event stream for ${sessionID}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <button type="button" className="modal-close" onClick={onClose}>
          close
        </button>
        <div className="modal-body">
          <EventStream sessionID={sessionID} />
        </div>
      </div>
    </div>
  );
}
