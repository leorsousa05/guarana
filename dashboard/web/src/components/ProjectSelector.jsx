export function ProjectSelector({
  projects = [], selectedProjectId, notice, busy = false,
  onSelect, onAdd, onRemove,
}) {
  const selected = projects.find((project) => project.id === selectedProjectId);
  return (
    <div className="project-picker" aria-label="Project selection">
      <label className="project-picker-field" htmlFor="dashboard-project">
        <span>Project</span>
        <select
          id="dashboard-project"
          aria-label="Project"
          value={selectedProjectId || ''}
          onChange={(event) => onSelect(event.currentTarget.value)}
          disabled={busy || !projects.length}
        >
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>
      <div className="project-picker-actions">
        <button type="button" className="project-action" disabled={busy} onClick={onAdd}>Add this project</button>
        <button type="button" className="project-action" disabled={busy || !selected?.registered} onClick={onRemove}>Remove selected project</button>
      </div>
      {notice && <p className="project-picker-notice" role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
    </div>
  );
}
