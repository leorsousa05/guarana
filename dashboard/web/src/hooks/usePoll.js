import { useEffect, useState } from 'react';

export function usePoll(url, intervalMs = 5000) {
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
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url, intervalMs, nonce]);
  return { data, error, refetch: () => setNonce((n) => n + 1) };
}
