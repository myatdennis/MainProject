import { useEffect, useState } from 'react';
import {
  getRuntimeStatus,
  RuntimeStatus,
  subscribeRuntimeStatus,
  refreshRuntimeStatus,
} from '../state/runtimeStatus';

export const useRuntimeStatus = () => {
  const [status, setStatus] = useState<RuntimeStatus>(() => getRuntimeStatus());

  useEffect(() => {
    const unsubscribe = subscribeRuntimeStatus(setStatus);
    refreshRuntimeStatus().catch(() => {
      // swallow errors; hook consumers can inspect status.lastError
    });
    return unsubscribe;
  }, []);

  return status;
};

export default useRuntimeStatus;
