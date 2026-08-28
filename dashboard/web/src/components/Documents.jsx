import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './common.jsx';
import { Markdown, MdLink } from '../lib/markdown.jsx';

const isDocPath = (rel) =>
  /^(changes|decisions|features|archive)\//.test(rel) || !/\//.test(rel);

const fallbackTitle = (rel) => rel.split('/').pop().replace(/\.md$/i, '');

const adrNum = (rel) => {
  const m = String(rel).match(/ADR-(\d+)/i);
  return m ? parseInt(m[1], 10) : Infinity;
};

export function buildGroups(tree) {
  const list = tree || [];
  const decisions = list
    .filter((p) => /^decisions\/ADR-\d+[^/]*\.md$/.test(p))
    .sort((a, b) => adrNum(a) - adrNum(b));
  const changes = list.filter((p) => /^changes\/[^/]+\.md$/.test(p)).sort();
  const features = list
    .filter((p) => /^features\/[^/]+\.md$/.test(p) || /^features\/[^/]+\/[^/]+\.md$/.test(p))
    .sort();
  const archive = list.filter((p) => /^archive\/[^/]+\.md$/.test(p)).sort();
  const foundations = list.filter((p) => /^[^/]+\.md$/.test(p)).sort();
  return [
    { key: 'decisions', label: 'Decisions', items: decisions },
    { key: 'changes', label: 'Changes', items: changes },
    { key: 'features', label: 'Features', items: features },
    { key: 'archive', label: 'Archive', items: archive },
    { key: 'foundations', label: 'Foundations', items: foundations },
  ];
}

export function ReadingPane({ path, onOpenFile, canOpen }) {
  const [content, setContent] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setContent(null);
    fetch(`/api/specs/file?path=${encodeURIComponent(path)}`)
      .then(async (res) => {
        if (cancelled) return;
        setContent(res.ok ? await res.text() : `error ${res.status}`);
      })
      .catch((e) => {
        if (!cancelled) setContent(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (content === null) return <p className="loading">loading document…</p>;
  return (
    <div className="reading-pane">
      <Markdown text={content} onOpenFile={onOpenFile} canOpen={canOpen} />
    </div>
  );
}

export function Documents({ tree, titles, active, onOpen, onOpenFile, canOpen }) {
  const groups = useMemo(() => buildGroups(tree), [tree]);
  const hasAny = groups.some((g) => g.items.length > 0);
  const [collapsed, setCollapsed] = useState({});
  return (
    <div className="documents">
      {!hasAny && <EmptyState copy="no documents found" />}
      {groups.map((g) => {
        if (g.items.length === 0) return null;
        const open = !collapsed[g.key];
        return (
          <section key={g.key} className="doc-category">
            <button
              type="button"
              className="doc-toggle"
              aria-expanded={open}
              aria-controls={`cat-${g.key}`}
              onClick={() => setCollapsed((c) => ({ ...c, [g.key]: open }))}
            >
              <span className="doc-toggle-label">{g.label}</span>
              <span className="doc-toggle-count">{g.items.length}</span>
            </button>
            {open && (
              <ul id={`cat-${g.key}`} className="doc-list">
                {g.items.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      className={p === active ? 'doc-item doc-item--on' : 'doc-item'}
                      onClick={() => onOpen(p)}
                    >
                      {titles[p] || fallbackTitle(p)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {active ? (
        <ReadingPane path={active} onOpenFile={onOpenFile} canOpen={canOpen} />
      ) : (
        <p className="empty-copy">select a document to read it</p>
      )}
    </div>
  );
}
