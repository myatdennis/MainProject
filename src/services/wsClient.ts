import toast from 'react-hot-toast';

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
  private notified = false;
  private readonly toastId = 'ws-client-status';

  constructor(url?: string) {
    super();
    const envUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
    const fallbackUrl = isBrowser ? `${window.location.origin.replace(/^http/, 'ws')}/ws` : undefined;
    this.url = url || envUrl || fallbackUrl;
    this.enabled = parseFlag(import.meta.env.VITE_ENABLE_WS as string | undefined, false);
    this.shouldReconnect = this.enabled;
  }

  connect() {
    if (!this.enabled) {
      this.notifyOnce('WebSocket client disabled (VITE_ENABLE_WS=false).', 'info');
      return;
    }

    if (!this.hasValidUrl()) {
      this.enabled = false;
      this.shouldReconnect = false;
      this.notifyOnce('WebSocket URL missing or invalid; realtime updates disabled.', 'error');
      return;
    }

    if (this.socket) return;

    try {
      this.socket = new WebSocket(this.url!);

      this.socket.addEventListener('open', () => {
        this.reconnectDelay = 1000;
        this.connected = true;
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

      this.socket.addEventListener('close', () => {
        this.connected = false;
        this.socket = null;
        this.emit('close');
        if (this.shouldReconnect && this.enabled) this.scheduleReconnect();
      });

      this.socket.addEventListener('error', (err) => {
        this.emit('error', err);
        // socket will trigger close event next
      });
    } catch (err) {
      this.emit('error', err);
      if (this.shouldReconnect && this.enabled) {
        this.scheduleReconnect();
      } else {
        this.notifyOnce('WebSocket connection failed and will not retry (disabled).', 'error');
      }
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private scheduleReconnect() {
    setTimeout(() => {
      if (!this.shouldReconnect || !this.enabled) return;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxDelay);
      this.connect();
    }, this.reconnectDelay + Math.floor(Math.random() * 500));
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
    if (this.notified) return;
    this.notified = true;
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
