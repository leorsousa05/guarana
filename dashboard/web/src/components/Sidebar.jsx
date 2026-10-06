const SECTIONS = [
  ['overview', 'Overview'],
  ['now', 'Now'],
  ['runs', 'Runs'],
  ['specs', 'Specs'],
  ['workflow', 'Workflow'],
  ['memory', 'Memory'],
  ['skills', 'Skills'],
];

export function Sidebar({ active, onSelect }) {
  return (
    <aside className="sidebar" aria-label="Dashboard sections">
      <nav className="sect-nav">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={active === id ? 'page' : undefined}
            className={`sect-nav-btn${active === id ? ' sect-nav-btn--active' : ''}`}
            onClick={() => onSelect(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
