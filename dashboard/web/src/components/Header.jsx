import { fmtAge } from '../lib/format.js';

export function Header({ lastEventTs, tickerTick, projectSelector }) {
  // tickerTick forces re-render so the "age" text stays fresh
  void tickerTick;
  return (
    <header className="header">
      <div className="header-brand">
        <p className="header-eyebrow">Engineering workflow</p>
        <h1 className="wordmark">
          guarana <span className="wordmark-sub">/ system of record</span>
        </h1>
      </div>
      <div className="header-meta">
        {projectSelector}
        <span className={`pill ${lastEventTs != null && Date.now() - lastEventTs < 15000 ? 'pill--live' : ''}`}>
          last event {fmtAge(lastEventTs)}
        </span>
        <span className="pill">port {location.port || '(default)'}</span>
      </div>
    </header>
  );
}
