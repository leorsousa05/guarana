const WORKSPACES = [
  {
    id: 'operation',
    label: 'Operation',
    destinations: [
      ['operation', 'Overview'],
      ['now', 'Activity'],
      ['runs', 'Runs'],
      ['workflow', 'Workflow'],
    ],
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    destinations: [
      ['knowledge', 'Knowledge home'],
      ['specs', 'Specs'],
      ['memory', 'Memory'],
      ['skills', 'Skills'],
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    destinations: [['settings', 'Settings']],
  },
];

export function Sidebar({ active, onSelect }) {
  return (
    <aside className="sidebar" aria-label="Dashboard sections">
      <div className="sidebar-brand">
        <svg className="sidebar-brand-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
          <path className="brand-mark-leaf" d="M20 15C21 7 27 3 35 3c-1 8-5 13-14 14" />
          <path className="brand-mark-seed" d="M18 13c-7 1-12 7-12 14 0 7 5 11 12 11s13-5 13-12c0-8-5-14-13-13Z" />
          <path className="brand-mark-vein" d="M12 27c4 1 8 4 10 9" />
        </svg>
        <span className="sidebar-brand-copy">
          <strong className="sidebar-brand-name">guarana</strong>
          <span className="sidebar-brand-edition">Fieldstation</span>
        </span>
      </div>
      <p className="sidebar-label">Workspaces</p>
      <nav className="sect-nav" aria-label="Dashboard workspaces">
        {WORKSPACES.map(({ id, label, destinations }) => (
          <section className="sect-nav-group" key={id} aria-labelledby={`sect-nav-${id}`}>
            <h2 className="sect-nav-group-title" id={`sect-nav-${id}`}>{label}</h2>
            <ul className="sect-nav-list">
              {destinations.map(([route, destination]) => {
                const current = active === route || (route === 'operation' && active === 'overview');
                return (
                  <li key={route}>
                    <button
                      type="button"
                      data-route={route}
                      aria-current={current ? 'page' : undefined}
                      className={`sect-nav-btn${current ? ' sect-nav-btn--active' : ''}`}
                      onClick={() => onSelect(route)}
                    >
                      {destination}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  );
}
