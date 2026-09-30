import { useEffect, useRef, useState } from 'react';
import { ErrorBanner } from './common.jsx';
import { Markdown } from '../lib/markdown.jsx';

const focusables = (root) =>
  root
    ? [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled)
    : [];

export function SpecsMarkdownModal({ title, text, path, onClose, onOpenFile, canOpen }) {
  const boxRef = useRef(null);
  const [content, setContent] = useState(text ?? null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const previous = document.activeElement;
    const box = boxRef.current;
    (box?.querySelector('.modal-close') || box)?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    if (text != null) {
      setContent(text);
      setError(null);
      return undefined;
    }
    if (!path) return undefined;
    let cancelled = false;
    setContent(null);
    setError(null);
    fetch(`/api/specs/file?path=${encodeURIComponent(path)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const markdown = await response.text();
        if (!cancelled) setContent(markdown);
      })
      .catch((cause) => {
        if (!cancelled) setError(String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [path, text]);

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
      <div
        ref={boxRef}
        className="modal modal--specs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="specs-modal-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <header className="specs-modal-head">
          <h2 id="specs-modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose}>close</button>
        </header>
        <div className="modal-body specs-modal-body">
          {error ? <ErrorBanner text={`Unable to load document: ${error}`} /> : null}
          {content === null && !error ? <p className="loading" role="status">loading document…</p> : null}
          {content !== null ? <Markdown text={content} onOpenFile={onOpenFile} canOpen={canOpen} /> : null}
        </div>
      </div>
    </div>
  );
}
