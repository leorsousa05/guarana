import { useEffect, useState } from 'react';

// Subscribe to a Server-Sent Events endpoint and return a counter that
// increments on every push. Pass the tick to usePoll (or an effect dep) to
// refetch immediately when the server signals a change. Browsers
// auto-reconnect EventSource on network errors.
export function useLiveTick(url) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource(url);
    es.onmessage = () => setTick((t) => t + 1);
    return () => es.close();
  }, [url]);
  return tick;
}
