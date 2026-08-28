const SECTIONS = [['now', 'Now'], ['runs', 'Runs'], ['specs', 'Specs']];

export function SectionNav() {
  return (
    <nav className="sect-nav" aria-label="Jump to section">
      {SECTIONS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className="sect-nav-btn"
          onClick={() => document.getElementById(id)?.scrollIntoView()}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
