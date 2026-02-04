import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { hasSupabaseConfig, SUPABASE_MISSING_CONFIG_MESSAGE } from '../lib/supabaseClient';
import { getRuntimeStatus, subscribeRuntimeStatus, type RuntimeStatus } from '../state/runtimeStatus';

interface StatusState {
  status: 'disabled' | 'error' | 'ready' | 'idle';
  reason?: string;
  message?: string;
}

const missingConfigMessage = SUPABASE_MISSING_CONFIG_MESSAGE;

const deriveStatusState = (runtime: RuntimeStatus): StatusState => {
  if (!runtime.supabaseConfigured || !hasSupabaseConfig()) {
    return {
      status: 'disabled',
      reason: 'missing-env',
      message: missingConfigMessage,
    };
  }

  if (!runtime.supabaseHealthy) {
    return {
      status: 'error',
      reason: runtime.lastError ?? 'supabase-offline',
      message: runtime.lastError ?? 'We could not connect to Supabase.',
    };
  }

  return {
    status: 'ready',
    reason: undefined,
    message: undefined,
  };
};

export const SupabaseStatusBanner = () => {
  const [status, setStatus] = useState<StatusState>(() => deriveStatusState(getRuntimeStatus()));

  useEffect(() => {
    const unsubscribe = subscribeRuntimeStatus((runtime) => {
      setStatus(deriveStatusState(runtime));
    });
    return unsubscribe;
  }, []);

  if (status.status === 'ready') {
    return null;
  }

  const isMissingConfig = status.status === 'disabled' && status.reason === 'missing-env';

  const bannerTitle = isMissingConfig ? 'Supabase is not configured' : 'Supabase connection issue';
  const description = isMissingConfig
    ? status.message || missingConfigMessage
    : status.message || 'We could not connect to Supabase. Writes are paused until this is resolved.';

  return (
    <div className="bg-red-50 border-y border-red-200 px-4 py-3 text-sm text-red-900">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" aria-hidden />
        <div>
          <p className="text-sm font-semibold">{bannerTitle}</p>
          <p className="text-sm text-red-800">{description}</p>
          <p className="mt-2 text-xs text-red-700">
            All data writes are disabled while Supabase is offline. Please configure your environment variables or
            try again later.
          </p>
        </div>
        {!isMissingConfig && (
          <div className="flex items-center gap-1 text-xs text-red-700">
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
            Checking…
          </div>
        )}
      </div>
    </div>
  );
};

export default SupabaseStatusBanner;
