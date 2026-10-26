import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ErrorBanner } from './common.jsx';
import { Markdown } from '../lib/markdown.jsx';
import { useProjectFetch } from '../lib/projectApi.js';

const focusables = (root) =>
  root
    ? [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled)
    : [];

const useFocusLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function scheduleFocusRestore(opener, schedule = (callback) => requestAnimationFrame(callback)) {
  schedule(() => {
    if (opener?.isConnected) opener.focus?.();
  });
}

export function SpecsMarkdownModal({ title, text, path, onClose, onOpenFile, canOpen }) {
  const projectFetch = useProjectFetch();
  const boxRef = useRef(null);
  const originalTriggerRef = useRef(null);
  const originalTriggerCapturedRef = useRef(false);
  const displayedDocumentRef = useRef({ title, text, path });
  const [content, setContent] = useState(text ?? null);
  const [error, setError] = useState(null);

  useFocusLayoutEffect(() => {
    if (!originalTriggerCapturedRef.current) {
      originalTriggerRef.current = document.activeElement;
      originalTriggerCapturedRef.current = true;
    }
    const box = boxRef.current;
    (box?.querySelector('.modal-close') || box)?.focus();
  }, []);

  useFocusLayoutEffect(() => {
    const previous = displayedDocumentRef.current;
    if (previous.title !== title || previous.text !== text || previous.path !== path) {
      (boxRef.current?.querySelector('.modal-close') || boxRef.current)?.focus();
    }
    displayedDocumentRef.current = { title, text, path };
  }, [title, text, path]);

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
    projectFetch(`/api/specs/file?path=${encodeURIComponent(path)}`)
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
  }, [path, text, projectFetch]);

  const handleClose = () => {
    const opener = originalTriggerRef.current;
    onClose();
    scheduleFocusRestore(opener);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
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
    <div className="modal-backdrop" onClick={handleClose}>
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
          <button type="button" className="modal-close" onClick={handleClose}>close</button>
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
