import { EventEmitter } from 'events';

type WSMessage = {
  topic?: string;
  type: string;
  data?: any;
  timestamp?: number;
};

class WSClient extends EventEmitter {
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
