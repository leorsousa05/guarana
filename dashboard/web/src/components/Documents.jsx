import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './common.jsx';

const fallbackTitle = (rel) => rel.split('/').pop().replace(/\.md$/i, '');

const adrNum = (rel) => {
  const match = String(rel).match(/ADR-(\d+)/i);
  return match ? parseInt(match[1], 10) : Infinity;
};

export function buildGroups(tree) {
  const list = (tree || []).filter((path) => !/^state\//.test(path));
  const decisions = list
    .filter((path) => /^decisions\/ADR-\d+[^/]*\.md$/.test(path))
    .sort((a, b) => adrNum(a) - adrNum(b));
  const known = [
    { key: 'decisions', label: 'Decisions', items: decisions },
    { key: 'changes', label: 'Changes', items: list.filter((path) => /^changes\/[^/]+\.md$/.test(path)) },
    { key: 'features', label: 'Features', items: list.filter((path) => /^features\/[^/]+\.md$/.test(path) || /^features\/[^/]+\/[^/]+\.md$/.test(path)) },
    { key: 'archive', label: 'Archive', items: list.filter((path) => /^archive\/[^/]+\.md$/.test(path)) },
    { key: 'foundations', label: 'Foundations', items: list.filter((path) => /^[^/]+\.md$/.test(path)) },
  ];
  for (const group of known) group.items.sort();

  // Preserve documents from unfamiliar .specs layouts; only state/ is owned by Overview.
  const knownPaths = new Set(known.flatMap((group) => group.items));
  const grouped = new Map();
  for (const path of list) {
    if (knownPaths.has(path)) continue;
    const top = path.split('/')[0];
    const items = grouped.get(top) || [];
    items.push(path);
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

export function filterDocumentGroups(groups, titles, query) {
  const needle = String(query || '').trim().toLocaleLowerCase();
  if (!needle) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.filter((path) => `${titles[path] || fallbackTitle(path)} ${path}`.toLocaleLowerCase().includes(needle)),
  })).filter((group) => group.items.length > 0);
}

export function Documents({ tree, titles, active, onOpen }) {
  const groups = useMemo(() => buildGroups(tree), [tree]);
  const [query, setQuery] = useState('');
  const nonEmptyGroups = useMemo(() => groups.filter((group) => group.items.length > 0), [groups]);
  const filteredGroups = useMemo(() => filterDocumentGroups(nonEmptyGroups, titles, query), [nonEmptyGroups, titles, query]);
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  const matches = filteredGroups.reduce((count, group) => count + group.items.length, 0);
  const [collapsed, setCollapsed] = useState(() => Object.fromEntries(
    groups.map((group) => [group.key, !group.items.includes(active)])
  ));

  useEffect(() => {
    if (!active) return;
    const activeGroup = groups.find((group) => group.items.includes(active));
    if (activeGroup) setCollapsed((current) => ({ ...current, [activeGroup.key]: false }));
  }, [active, groups]);

  useEffect(() => {
    if (!query.trim()) return;
    const matching = filterDocumentGroups(nonEmptyGroups, titles, query);
    setCollapsed((current) => {
      const next = { ...current };
      let changed = false;
      for (const group of matching) {
        if (next[group.key]) {
          next[group.key] = false;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [nonEmptyGroups, query, titles]);

  const selectedTitle = active ? titles[active] || fallbackTitle(active) : null;
  const hasSearch = Boolean(query.trim());
  return (
    <div className="spec-documents">
      <section className="spec-doc-navigator" aria-labelledby="spec-documents-title">
        <header className="spec-section-head">
          <div>
            <p className="spec-kicker">Browse the record</p>
            <h3 id="spec-documents-title">Documents</h3>
          </div>
          <span className="spec-doc-total">{total} documents</span>
        </header>
        <div className="spec-doc-search">
          <label htmlFor="spec-doc-search">Search documents</label>
          <input
            id="spec-doc-search"
            type="search"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (nextQuery.trim()) {
                const matching = filterDocumentGroups(nonEmptyGroups, titles, nextQuery);
                setCollapsed((current) => ({ ...current, ...Object.fromEntries(matching.map((group) => [group.key, false])) }));
              }
            }}
            placeholder="Title or path"
            aria-describedby="spec-doc-search-count"
          />
          <p id="spec-doc-search-count" className="spec-doc-search-count" role="status">
            {hasSearch ? `${matches} of ${total} documents match` : `${total} documents in ${groups.filter((group) => group.items.length).length} categories`}
          </p>
        </div>
        {total === 0 ? (
          <EmptyState copy="no documents found" />
        ) : filteredGroups.length === 0 ? (
          <EmptyState copy="No documents match this search." />
        ) : (
          <nav className="documents" aria-label="Specs document categories">
            {filteredGroups.map((group) => {
              const open = !collapsed[group.key];
              const listId = `spec-doc-list-${group.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
              const count = hasSearch ? `${group.items.length} match${group.items.length === 1 ? '' : 'es'}` : `${group.items.length}`;
              return (
                <section key={group.key} className="doc-category">
                  <button
                    type="button"
                    className="doc-toggle"
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => setCollapsed((current) => ({ ...current, [group.key]: open }))}
                  >
                    <span className="doc-toggle-label">{group.label}</span>
                    <span className="doc-toggle-count">{count}</span>
                  </button>
                  <ul id={listId} className="doc-list" hidden={!open}>
                    {group.items.map((path) => (
                      <li key={path}>
                        <button
                          type="button"
                          className={path === active ? 'doc-item doc-item--on' : 'doc-item'}
                          aria-current={path === active ? 'page' : undefined}
                          onClick={() => onOpen(path)}
                        >
                          <span className="doc-item-title">{titles[path] || fallbackTitle(path)}</span>
                          <span className="doc-item-path">{path}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </nav>
        )}
      </section>
      <section className="spec-reading-surface" aria-labelledby="spec-reading-title">
        <p className="spec-kicker">Reading surface</p>
        {active ? (
          <>
            <h3 id="spec-reading-title">{selectedTitle}</h3>
            <code className="spec-reading-path">{active}</code>
            <p>The full Markdown opens in the focused reader. Local document links remain available there.</p>
            <button type="button" className="spec-read-button" onClick={() => onOpen(active)}>Open full document</button>
          </>
        ) : (
          <>
            <h3 id="spec-reading-title">Choose a document</h3>
            <p>Select a title from the navigator to read its Markdown in the document reader.</p>
          </>
        )}
      </section>
    </div>
  );
}
