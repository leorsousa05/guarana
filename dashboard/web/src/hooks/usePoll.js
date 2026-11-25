import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ProjectIdContext, projectApiUrl } from '../lib/projectApi.js';

export const PollIntervalContext = createContext(5000);

export function pollIntervalFor(intervalMs, liveIntervalMs) {
  return intervalMs === 5000 ? liveIntervalMs : intervalMs;
}

export function createSingleFlightRunner() {
  let active = false;
  let queued = false;
  let task = null;

  const run = async (manual = false) => {
    if (active) {
      if (manual) queued = true;
      return;
    }
    if (!task) return;
    active = true;
    try {
      await task();
    } finally {
      active = false;
      if (queued) {
        queued = false;
        void run(true);
      }
    }
  };
  return {
    setTask(nextTask) { task = nextTask; },
    run,
  };
}

export function usePoll(url, intervalMs = 5000) {
  const liveIntervalMs = useContext(PollIntervalContext);
  const projectId = useContext(ProjectIdContext);
  const effectiveIntervalMs = pollIntervalFor(intervalMs, liveIntervalMs);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const controllerRef = useRef(null);
  const pollerRef = useRef(null);
  if (!pollerRef.current) pollerRef.current = createSingleFlightRunner();

  useEffect(() => {
    if (!url) {
      pollerRef.current.setTask(null);
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        const res = await fetch(projectApiUrl(url, projectId), { signal: controller.signal });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
          setLastUpdated(Date.now());
        }
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') setError(String(e));
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    };
    pollerRef.current.setTask(load);
    void pollerRef.current.run(true);
    const id = setInterval(() => pollerRef.current.run(), effectiveIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
      if (controllerRef.current) controllerRef.current.abort();
      pollerRef.current.setTask(null);
    };
  }, [url, effectiveIntervalMs, projectId]);

  const refetch = useCallback(() => pollerRef.current.run(true), []);
  return { data, error, lastUpdated, refetch };
}
