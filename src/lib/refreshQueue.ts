const REFRESH_TIMEOUT_MS = 15_000;

let inFlight: Promise<boolean> | null = null;
let resolveExternal: ((value: boolean) => void) | null = null;
let activeToken: string | null = null;
let watchdog: ReturnType<typeof setTimeout> | null = null;

const channel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('auth-refresh') : null;

const resetState = () => {
  if (watchdog) {
    clearTimeout(watchdog);
    watchdog = null;
  }
  resolveExternal = null;
  inFlight = null;
  activeToken = null;
};

const startWatchdog = () => {
  if (watchdog) {
    clearTimeout(watchdog);
  }
  watchdog = setTimeout(() => {
    if (!activeToken) {
      return;
    }
    console.warn('[refreshQueue] Refresh watchdog expired, clearing stale state');
    resolveExternal?.(false);
    channel?.postMessage({ type: 'refresh-timeout', token: activeToken });
    resetState();
  }, REFRESH_TIMEOUT_MS);
};

if (channel) {
  channel.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.type === 'refresh-start' && data.token) {
      activeToken = data.token;
      if (!inFlight) {
        inFlight = new Promise<boolean>((resolve) => {
          resolveExternal = resolve;
        });
      }
      startWatchdog();
      return;
    }

    if (data.type === 'refresh-end' && data.token === activeToken) {
      resolveExternal?.(Boolean(data.success));
      resetState();
      return;
    }

    if (data.type === 'refresh-timeout' && data.token === activeToken) {
      resolveExternal?.(false);
      resetState();
    }
  });
}

const generateToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `refresh-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/**
 * Enqueue a refresh operation so only one refresh runs at a time across tabs.
 */
export function queueRefresh(doRefresh: () => Promise<boolean>): Promise<boolean> {
  if (inFlight) {
    return inFlight;
  }

  const token = generateToken();
  activeToken = token;
  channel?.postMessage({ type: 'refresh-start', token, startedAt: Date.now() });
  startWatchdog();

  inFlight = (async () => {
    try {
      const result = await doRefresh();
      channel?.postMessage({ type: 'refresh-end', token, success: result });
      resetState();
      return result;
    } catch (error) {
      console.warn('[refreshQueue] Refresh operation failed', error);
      channel?.postMessage({ type: 'refresh-end', token, success: false });
      resetState();
      throw error;
    }
  })();

  return inFlight;
}
