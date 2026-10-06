import { useState } from 'react';
import { usePoll } from '../hooks/usePoll.js';
import { EmptyState, ErrorBanner, handleTabKeyDown } from './common.jsx';
import { SpecsMarkdownModal } from './SpecsMarkdownModal.jsx';

const TABS = [
  ['global', 'Global'],
  ['project', 'Project'],
];

export function SkillScopeTabs({ response, scope, onScopeChange }) {
  const skillsByScope = response.data && !response.error && !response.data.error
    ? response.data
    : null;

  return (
    <div
      className="spec-tabs"
      role="tablist"
      aria-label="Skill scope"
      onKeyDown={(event) => handleTabKeyDown(event, TABS.map(([id]) => id), onScopeChange)}
    >
      {TABS.map(([id, label]) => {
        const count = Array.isArray(skillsByScope?.[id])
          ? ` (${skillsByScope[id].length})`
          : '';

        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`skills-tab-${id}`}
            data-tab-id={id}
            aria-controls={`skills-panel-${id}`}
            aria-selected={scope === id}
            tabIndex={scope === id ? 0 : -1}
            className={scope === id ? 'spec-tab spec-tab--on' : 'spec-tab'}
            onClick={() => onScopeChange(id)}
          >
            {label}{count}
          </button>
        );
      })}
    </div>
  );
}

export function Skills() {
  const data = usePoll('/api/skills', 5000);
  const [scope, setScope] = useState('global');
  const [reading, setReading] = useState(null);
  const skills = data.data?.[scope] || [];

  return (
    <section id="skills" aria-label="Skills">
      <h2 className="section-title">Skills</h2>

      <SkillScopeTabs response={data} scope={scope} onScopeChange={setScope} />

      {data.error && <ErrorBanner text={`Unable to load skills: ${data.error}`} />}
      {!data.data && !data.error && <p className="loading" role="status">loading skills…</p>}
      {data.data && (
        <div id={`skills-panel-${scope}`} role="tabpanel" aria-labelledby={`skills-tab-${scope}`} tabIndex={0}>
          {data.data.error && <ErrorBanner text={`Unable to load skills: ${data.data.error}`} />}
          {!skills.length && !data.data.error && (
            <EmptyState copy={`No generated ${scope} skills yet. Reusable procedures will appear here when Guarana creates them.`} />
          )}
          {skills.length > 0 && (
            <ul className="skill-list" aria-label={`${scope} generated skills`}>
              {skills.map((skill) => (
                <li key={`${skill.scope}:${skill.name}`}>
                  <button
                    type="button"
                    className="skill-entry"
                    onClick={() => setReading(skill)}
                    aria-label={`Read ${skill.name}: ${skill.description}`}
                  >
                    <span className="skill-entry-name">{skill.name}</span>
                    <span className="skill-entry-description">{skill.description}</span>
                    <span className="skill-entry-action">Read</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {reading && (
        <SpecsMarkdownModal
          title={reading.name}
          text={reading.content}
          onClose={() => setReading(null)}
        />
      )}
    </section>
  );
}
