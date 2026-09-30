import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './common.jsx';

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
  const known = [
    { key: 'decisions', label: 'Decisions', items: decisions },
    { key: 'changes', label: 'Changes', items: list.filter((p) => /^changes\/[^/]+\.md$/.test(p)) },
    { key: 'features', label: 'Features', items: list.filter((p) => /^features\/[^/]+\.md$/.test(p) || /^features\/[^/]+\/[^/]+\.md$/.test(p)) },
    { key: 'archive', label: 'Archive', items: list.filter((p) => /^archive\/[^/]+\.md$/.test(p)) },
    { key: 'foundations', label: 'Foundations', items: list.filter((p) => /^[^/]+\.md$/.test(p)) },
  ];
  for (const g of known) g.items.sort();

  // Group ANY remaining deep path by its top-level directory, so foreign
  // `.specs` layouts (e.g. decisions/*, memory/, shared/, state/) still render
  // instead of silently dropping every document.
  const knownPaths = new Set(known.flatMap((g) => g.items));
  const grouped = new Map();
  for (const p of list) {
    if (knownPaths.has(p)) continue;
    const top = p.split('/')[0];
    const items = grouped.get(top) || [];
    items.push(p);
    grouped.set(top, items);
  }
  const extra = Array.from(grouped.entries())
    .map(([dir, items]) => ({
      key: `dir:${dir}`,
      label: dir.charAt(0).toUpperCase() + dir.slice(1),
      items: items.sort(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [...known, ...extra];
}

export function Documents({ tree, titles, active, onOpen }) {
  const groups = useMemo(() => buildGroups(tree), [tree]);
  const hasAny = groups.some((g) => g.items.length > 0);
  const [collapsed, setCollapsed] = useState(() => Object.fromEntries(groups.map((group) => [group.key, true])));
  useEffect(() => {
    if (!active) return;
    const activeGroup = groups.find((group) => group.items.includes(active));
    if (activeGroup) setCollapsed((current) => ({ ...current, [activeGroup.key]: false }));
  }, [active, groups]);
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
      <p className="documents-hint">
        {active ? 'Selected document is open in the reading window.' : 'Choose a document to open its full text.'}
      </p>
    </div>
  );
}
