import { createContext, useContext, useEffect, useState } from 'react';

export const PollIntervalContext = createContext(5000);

export function pollIntervalFor(intervalMs, liveIntervalMs) {
  return intervalMs === 5000 ? liveIntervalMs : intervalMs;
}

export function usePoll(url, intervalMs = 5000, tick = 0) {
  const liveIntervalMs = useContext(PollIntervalContext);
  const effectiveIntervalMs = pollIntervalFor(intervalMs, liveIntervalMs);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    load();
    const id = setInterval(load, effectiveIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url, effectiveIntervalMs, nonce, tick]);
  return { data, error, refetch: () => setNonce((n) => n + 1) };
}
