// Small broadcaster helper so modules can emit broadcast events without importing server/index.js
let _broadcaster = null;

export function setBroadcaster(fn) {
  _broadcaster = typeof fn === 'function' ? fn : null;
}

export function broadcastToTopic(topic, payload) {
  try {
    if (typeof _broadcaster === 'function') {
      _broadcaster(topic, payload);
    }
  } catch (err) {
    // best-effort: swallow errors
    try {
      console.warn('[broadcaster] emit failed', err?.message || String(err));
    } catch (_) {}
  }
}

export default {
  setBroadcaster,
  broadcastToTopic,
};
