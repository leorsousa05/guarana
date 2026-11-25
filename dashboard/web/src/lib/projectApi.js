import { createContext, useCallback, useContext } from 'react';

export const ProjectIdContext = createContext(null);
export const PROJECT_STORAGE_KEY = 'guarana.dashboard.projectId';

export function projectApiUrl(input, projectId) {
  if (!projectId || typeof input !== 'string') return input;
  const url = new URL(input, 'http://guarana.local');
  if (!url.pathname.startsWith('/api/') || url.pathname === '/api/projects' || url.pathname.startsWith('/api/projects/')) return input;
  url.searchParams.set('projectId', projectId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function projectFetch(input, projectId, options) {
  return globalThis.fetch(projectApiUrl(input, projectId), options);
}

export function useProjectFetch() {
  const projectId = useContext(ProjectIdContext);
  return useCallback((input, options) => projectFetch(input, projectId, options), [projectId]);
}

export function resolveProjectSelection(projectsResponse, savedId) {
  const projects = Array.isArray(projectsResponse?.projects) ? projectsResponse.projects : [];
  const currentProjectId = projectsResponse?.currentProjectId;
  if (savedId && projects.some((project) => project.id === savedId)) {
    return { projectId: savedId, stale: false };
  }
  return {
    projectId: currentProjectId,
    stale: Boolean(savedId && savedId !== currentProjectId),
  };
}

export function readSavedProjectId(storage) {
  try { return (storage ?? globalThis.localStorage)?.getItem(PROJECT_STORAGE_KEY) || null; }
  catch { return null; }
}

export function saveProjectId(projectId, storage) {
  try { (storage ?? globalThis.localStorage)?.setItem(PROJECT_STORAGE_KEY, projectId); }
  catch { /* selection still applies for this page session */ }
}

export async function addCurrentProject(request = fetch) {
  const response = await request('/api/projects', { method: 'POST' });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || `${response.status} ${response.statusText}`);
  return body.project;
}

export async function removeRegisteredProject(projectId, request = fetch) {
  const response = await request(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || `${response.status} ${response.statusText}`);
  return body;
}
