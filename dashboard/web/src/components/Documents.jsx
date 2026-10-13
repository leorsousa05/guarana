import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './common.jsx';
import { buildGroups, filterDocumentGroups } from './documentsTaxonomy.js';

export { buildGroups, filterDocumentGroups };

const fallbackTitle = (rel) => rel.split('/').pop().replace(/\.md$/i, '');
const countDocuments = (groups) => groups.reduce((count, group) => count + group.count, 0);

const containsPath = (group, path) => group.items.includes(path)
  || group.children.some((child) => containsPath(child, path));

const groupEntries = (groups) => groups.flatMap((group) => [
  [group.key, group],
  ...groupEntries(group.children),
]);

export function Documents({ tree, titles, active, onOpen }) {
  const groups = useMemo(() => buildGroups(tree), [tree]);
  const [query, setQuery] = useState('');
  const filteredGroups = useMemo(() => filterDocumentGroups(groups, titles, query), [groups, titles, query]);
  const total = countDocuments(groups);
  const matches = countDocuments(filteredGroups);
  const [collapsed, setCollapsed] = useState(() => Object.fromEntries(
    groupEntries(groups).map(([key, group]) => [key, !active || !containsPath(group, active)])
  ));

  useEffect(() => {
    if (!active) return;
    const activeGroups = groupEntries(groups)
      .filter(([, group]) => containsPath(group, active))
      .map(([key]) => key);
    if (activeGroups.length) {
      setCollapsed((current) => ({ ...current, ...Object.fromEntries(activeGroups.map((key) => [key, false])) }));
    }
  }, [active, groups]);

  useEffect(() => {
    if (!query.trim()) return;
    const matchingKeys = groupEntries(filteredGroups).map(([key]) => key);
    setCollapsed((current) => {
      const next = { ...current, ...Object.fromEntries(matchingKeys.map((key) => [key, false])) };
      return matchingKeys.some((key) => current[key]) ? next : current;
    });
  }, [filteredGroups, query]);

  const selectedTitle = active ? titles[active] || fallbackTitle(active) : null;
  const hasSearch = Boolean(query.trim());
  const renderGroup = (current) => {
    const open = !collapsed[current.key];
    const listId = `spec-doc-list-${encodeURIComponent(current.key)}`;
    const count = hasSearch ? `${current.count} match${current.count === 1 ? '' : 'es'}` : `${current.count}`;
    return (
      <li key={current.key} className="doc-category">
        <button
          type="button"
          className="doc-toggle"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setCollapsed((state) => ({ ...state, [current.key]: open }))}
        >
          <span className="doc-toggle-label">{current.label}</span>
          <span className="doc-toggle-count">{count}</span>
        </button>
        <div id={listId} className="doc-group-content" hidden={!open}>
          {current.items.length > 0 && (
            <ul className="doc-list">
              {current.items.map((path) => (
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
          )}
          {current.children.length > 0 && (
            <ul className="doc-children">
              {current.children.map(renderGroup)}
            </ul>
          )}
        </div>
      </li>
    );
  };

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
                const matching = filterDocumentGroups(groups, titles, nextQuery);
                setCollapsed((current) => ({
                  ...current,
                  ...Object.fromEntries(groupEntries(matching).map(([key]) => [key, false])),
                }));
              }
            }}
            placeholder="Title or path"
            aria-describedby="spec-doc-search-count"
          />
          <p id="spec-doc-search-count" className="spec-doc-search-count" role="status">
            {hasSearch ? `${matches} of ${total} documents match` : `${total} documents in ${groups.length} categories`}
          </p>
        </div>
        {total === 0 ? (
          <EmptyState copy="no documents found" />
        ) : filteredGroups.length === 0 ? (
          <EmptyState copy="No documents match this search." />
        ) : (
          <nav className="documents" aria-label="Specs document categories">
            <ul className="doc-tree">
              {filteredGroups.map(renderGroup)}
            </ul>
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
