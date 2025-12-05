import { API_ORIGIN } from '../lib/apiClient';
// Lightweight browser-friendly event emitter (avoid Node 'events' polyfills)
class SimpleEmitter {
    constructor() {
        this.listeners = new Map();
    }
    on(event, cb) {
        if (!this.listeners.has(event))
            this.listeners.set(event, new Set());
        this.listeners.get(event).add(cb);
    }
    off(event, cb) {
        if (!cb) {
            this.listeners.delete(event);
            return;
        }
        const set = this.listeners.get(event);
        set?.delete(cb);
        if (set && set.size === 0)
            this.listeners.delete(event);
    }
    emit(event, ...args) {
        const set = this.listeners.get(event);
        if (!set)
            return;
        for (const cb of Array.from(set)) {
            try {
                cb(...args);
            }
            catch (e) {
                // swallow listener errors to avoid breaking others
                console.error('[SimpleEmitter] listener error', e);
            }
        }
    }
}
const deriveDefaultWsUrl = () => {
    const explicit = (import.meta.env.VITE_WS_URL || '').trim();
    if (explicit) {
        return explicit;
    }
    const proto = API_ORIGIN.startsWith('https') ? 'wss' : 'ws';
    return `${API_ORIGIN.replace(/^https?/, proto)}/ws`;
};
class WSClient extends SimpleEmitter {
    constructor(url) {
        super();
        this.socket = null;
        this.reconnectDelay = 1000;
        this.maxDelay = 30000;
        this.shouldReconnect = true;
        this.connected = false;
        this.url = url || deriveDefaultWsUrl();
    }
    connect() {
        if (this.socket)
            return;
        try {
            this.socket = new WebSocket(this.url);
            this.socket.addEventListener('open', () => {
                this.reconnectDelay = 1000;
                this.connected = true;
                this.emit('open');
            });
            this.socket.addEventListener('message', (ev) => {
                try {
                    const payload = JSON.parse(ev.data);
                    // Normalize event shape
                    this.emit('event', payload);
                    this.emit(payload.type, payload);
                }
                catch (err) {
                    // If not JSON, emit raw
                    this.emit('raw', ev.data);
                }
            });
            this.socket.addEventListener('close', () => {
                this.connected = false;
                this.socket = null;
                this.emit('close');
                if (this.shouldReconnect)
                    this.scheduleReconnect();
            });
            this.socket.addEventListener('error', (err) => {
                this.emit('error', err);
                // socket will trigger close event next
            });
        }
        catch (err) {
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
    scheduleReconnect() {
        setTimeout(() => {
            if (!this.shouldReconnect)
                return;
            this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxDelay);
            this.connect();
        }, this.reconnectDelay + Math.floor(Math.random() * 500));
    }
    send(msg) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            // queueing could be added here
            this.emit('send_failed', msg);
            return false;
        }
        try {
            this.socket.send(JSON.stringify(msg));
            return true;
        }
        catch (err) {
            this.emit('error', err);
            return false;
        }
    }
    subscribeTopic(topic) {
        this.send({ type: 'subscribe', topic });
    }
    unsubscribeTopic(topic) {
        this.send({ type: 'unsubscribe', topic });
    }
    isConnected() {
        return this.connected;
    }
}
export const wsClient = new WSClient();
export default wsClient;
