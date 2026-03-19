import { useEffect, useState } from 'react';
import {
  getRuntimeStatus,
  RuntimeStatus,
  subscribeRuntimeStatus,
  refreshRuntimeStatus,
} from '../state/runtimeStatus';

/** Max age (ms) below which a cached status is considered fresh enough that a
 *  mount-time refresh is not needed.  The module-level polling interval is 30s,
 *  so 25s gives a comfortable margin without triggering redundant fetches on
 *  every page navigation. */
const STALE_THRESHOLD_MS = 25_000;

export const useRuntimeStatus = () => {
  const [status, setStatus] = useState<RuntimeStatus>(() => getRuntimeStatus());

  useEffect(() => {
    const unsubscribe = subscribeRuntimeStatus(setStatus);

    // Only trigger a refresh if there is no recent cached result.
    // The module-level ensureRuntimeStatusPolling() already fires on load and
    // every 30 s, so page-mount refreshes are only needed when the cache is
    // genuinely stale (e.g. first render before the first poll completes).
    const current = getRuntimeStatus();
    const age = current.lastChecked !== null ? Date.now() - current.lastChecked : Infinity;
    if (age > STALE_THRESHOLD_MS) {
      refreshRuntimeStatus().catch(() => {
        // swallow; consumers inspect status.lastError
      });
    }

    return unsubscribe;
  }, []);

  return status;
};

export default useRuntimeStatus;
