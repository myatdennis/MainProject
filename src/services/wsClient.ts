type WSMessage = {
  topic?: string;
  type: string;
  data?: any;
  timestamp?: number;
};
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
  private url: string;
  private socket: WebSocket | null = null;
  private reconnectDelay = 1000;
  private maxDelay = 30000;
  private shouldReconnect = true;
  private connected = false;

  constructor(url?: string) {
    super();
    this.url = url || (import.meta.env.VITE_WS_URL as string) || `${location.origin.replace(/^http/, 'ws')}/ws`;
  }

  connect() {
    if (this.socket) return;

    try {
      this.socket = new WebSocket(this.url);

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
        if (this.shouldReconnect) this.scheduleReconnect();
      });

      this.socket.addEventListener('error', (err) => {
        this.emit('error', err);
        // socket will trigger close event next
      });
    } catch (err) {
      this.emit('error', err);
      this.scheduleReconnect();
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
      if (!this.shouldReconnect) return;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxDelay);
      this.connect();
    }, this.reconnectDelay + Math.floor(Math.random() * 500));
  }

  send(msg: WSMessage) {
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
}

export const wsClient = new WSClient();
export default wsClient;
