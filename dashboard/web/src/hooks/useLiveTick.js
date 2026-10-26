import { useContext, useEffect, useState } from 'react';
import { ProjectIdContext, projectApiUrl } from '../lib/projectApi.js';

// Subscribe to a Server-Sent Events endpoint and return a counter that
// increments on every push. Pass the tick to usePoll (or an effect dep) to
// refetch immediately when the server signals a change. Browsers
// auto-reconnect EventSource on network errors.
export function useLiveTick(url) {
  const [tick, setTick] = useState(0);
  const projectId = useContext(ProjectIdContext);
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource(projectApiUrl(url, projectId));
    es.onmessage = () => setTick((t) => t + 1);
    return () => es.close();
  }, [url, projectId]);
  return tick;
}
