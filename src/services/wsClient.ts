import toast from 'react-hot-toast';
import { resolveWsUrl } from '../config/apiBase';
import { getRuntimeStatus, subscribeRuntimeStatus } from '../state/runtimeStatus';
import type { RuntimeStatus } from '../state/runtimeStatus';

type WSMessage = {
  topic?: string;
  type: string;
  data?: any;
  timestamp?: number;
};

const parseFlag = (value?: string, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const isBrowser = typeof window !== 'undefined';
const devMode = Boolean((import.meta as any)?.env?.DEV);
// Lightweight browser-friendly event emitter (avoid Node 'events' polyfills)
class SimpleEmitter {
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  on(event: string, cb: (...args: unknown[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off(event: string, cb?: (...args: unknown[]) => void) {
    if (!cb) {
      this.listeners.delete(event);
      return;
    }
    const set = this.listeners.get(event);
    set?.delete(cb);
    if (set && set.size === 0) this.listeners.delete(event);
  }

  emit(event: string, ...args: any[]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of Array.from(set)) {
      try {
        cb(...args);
      } catch (e) {
        // swallow listener errors to avoid breaking others
        console.error('[SimpleEmitter] listener error', e);
      }
    }
  }
}

class WSClient extends SimpleEmitter {
  private url?: string;
  private socket: WebSocket | null = null;
  private reconnectDelay = 1000;
  private maxDelay = 30000;
  private shouldReconnect = false;
  private connected = false;
  private enabled: boolean;
  private notifiedMessages = new Set<string>();
  private readonly toastId = 'ws-client-status';
  private failureCount = 0;
  private readonly isDev = devMode;
  private readonly maxFailuresBeforeDisable = devMode ? 1 : 5;
  private featureFlagEnabled: boolean;
  private runtimeWsEnabled: boolean;
  private unsubscribeRuntimeStatus?: () => void;
  private connectionAttempted = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private devFallbackLogged = false;

  constructor(url?: string) {
    super();
    const computedUrl = url || resolveWsUrl('/ws');
    this.url = computedUrl || undefined;
    this.featureFlagEnabled = parseFlag(import.meta.env.VITE_ENABLE_WS as string | undefined, devMode);
    this.runtimeWsEnabled = this.readRuntimeWsAvailability();
    this.enabled = this.computeEnabled();
    this.shouldReconnect = this.enabled;
    this.subscribeToRuntimeStatus();
  }

  private computeEnabled() {
    if (this.isDev) {
      return this.featureFlagEnabled;
    }
    return this.featureFlagEnabled || this.runtimeWsEnabled;
  }

  private readRuntimeWsAvailability() {
    if (!isBrowser) return false;
    try {
      const status = getRuntimeStatus();
      return Boolean(status?.wsEnabled);
    } catch {
      return false;
    }
  }

  private subscribeToRuntimeStatus() {
    if (!isBrowser) return;
    this.unsubscribeRuntimeStatus?.();
    this.unsubscribeRuntimeStatus = subscribeRuntimeStatus((status: RuntimeStatus) => {
      this.handleRuntimeStatus(status);
    });
  }

  private handleRuntimeStatus(status: RuntimeStatus) {
    this.runtimeWsEnabled = Boolean(status.wsEnabled);
    const prevEnabled = this.enabled;
    const nextEnabled = this.computeEnabled();
    if (nextEnabled === prevEnabled) {
      return;
    }

    this.enabled = nextEnabled;
    this.shouldReconnect = nextEnabled;
    this.emit('status', { enabled: nextEnabled, source: 'runtime' });

    if (!nextEnabled) {
      this.clearReconnectTimer();
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      return;
    }

    this.failureCount = 0;
    this.reconnectDelay = 1000;
    if (this.connectionAttempted && !this.socket) {
      this.connect();
    }
  }

  connect() {
    this.connectionAttempted = true;

    if (!this.enabled) {
      this.notifyOnce('WebSocket client disabled (waiting for ENABLE_WS flag or backend availability).', 'info');
      return;
    }

    if (!this.hasValidUrl()) {
      this.disableRealtime('WebSocket URL missing or invalid; realtime updates disabled.', 'warn');
      return;
    }

    if (this.socket) return;

    try {
      this.socket = new WebSocket(this.url!);

      this.socket.addEventListener('open', () => {
        this.reconnectDelay = 1000;
        this.connected = true;
        this.failureCount = 0;
        this.emit('open');
      });

      this.socket.addEventListener('message', (ev) => {
        try {
          const payload: WSMessage = JSON.parse(ev.data);
          // Normalize event shape
          this.emit('event', payload);
          this.emit(payload.type, payload);
        } catch (err) {
          // If not JSON, emit raw
          this.emit('raw', ev.data);
        }
      });

      this.socket.addEventListener('close', (event) => {
        this.connected = false;
        this.socket = null;
        this.emit('close');
        const reason = event ? `close:${event.code}` : 'socket_closed';
        this.registerFailure(reason);
        if (this.shouldReconnect && this.enabled) this.scheduleReconnect();
      });

      this.socket.addEventListener('error', (err) => {
        this.emit('error', err);
        const reason = err instanceof Error ? err.message : undefined;
        this.registerFailure(reason);
        // socket will trigger close event next
      });
    } catch (err) {
      this.emit('error', err);
      const reason = err instanceof Error ? err.message : String(err);
      this.registerFailure(reason);
      if (this.shouldReconnect && this.enabled) {
        this.scheduleReconnect();
      } else {
        this.notifyOnce('WebSocket connection failed and will not retry (disabled).', 'error');
      }
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.connectionAttempted = false;
    this.clearReconnectTimer();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.shouldReconnect || !this.enabled) {
      return;
    }
    const jitter = Math.floor(Math.random() * 500);
    const delay = this.reconnectDelay + jitter;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.shouldReconnect || !this.enabled) return;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxDelay);
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private disableRealtime(message: string, severity: 'info' | 'warn' | 'error' = 'warn') {
    this.shouldReconnect = false;
    this.enabled = false;
    this.clearReconnectTimer();
    if (this.socket) {
      try {
        this.socket.close();
      } catch (error) {
        console.debug('[WSClient] Failed to close socket while disabling realtime', error);
      }
      this.socket = null;
    }
    this.emit('status', { enabled: false, source: 'client' });
    this.notifyOnce(message, severity);
  }

  private registerFailure(reason?: string) {
    if (this.connected) return;
    this.failureCount += 1;

    if (this.isDev && !this.devFallbackLogged) {
      this.devFallbackLogged = true;
      const context = reason ? ` (${reason})` : '';
      console.info(`[WSClient] Dev backend websocket unavailable${context}; falling back to Supabase/polling.`);
      this.disableRealtime('WebSocket backend unavailable in dev; relying on Supabase realtime.', 'info');
      return;
    }

    if (this.failureCount >= this.maxFailuresBeforeDisable) {
      this.disableRealtime('WebSocket connection unavailable; continuing without realtime updates.', 'warn');
    }
  }

  send(msg: WSMessage) {
    if (!this.enabled) {
      this.emit('send_failed', msg);
      return false;
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // queueing could be added here
      this.emit('send_failed', msg);
      return false;
    }
    try {
      this.socket.send(JSON.stringify(msg));
      return true;
    } catch (err) {
      this.emit('error', err);
      return false;
    }
  }

  subscribeTopic(topic: string) {
    this.send({ type: 'subscribe', topic });
  }

  unsubscribeTopic(topic: string) {
    this.send({ type: 'unsubscribe', topic });
  }

  isConnected() {
    return this.connected;
  }

  isEnabled() {
    return this.enabled;
  }

  private hasValidUrl() {
    return typeof this.url === 'string' && /^wss?:\/\//.test(this.url);
  }

  private notifyOnce(message: string, severity: 'info' | 'warn' | 'error' = 'warn') {
    if (this.notifiedMessages.has(message)) return;
    this.notifiedMessages.add(message);
    const log = severity === 'error' ? console.error : console.warn;
    log(`[WSClient] ${message}`);

    if (!isBrowser) return;

    const toastFn = severity === 'error' ? toast.error : toast;
    try {
      toastFn(message, { id: this.toastId, duration: 5000 });
    } catch (error) {
      console.debug('[WSClient] Unable to display toast notification', error);
    }
  }
}

export const wsClient = new WSClient();
export default wsClient;
