import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || process.env.JOBS_REDIS_URL || null;
let redis = null;
if (REDIS_URL) {
  try {
    // Configure ioredis for request-path safety:
    // - disable offline queue so commands error fast when not connected
    // - limit maxRetriesPerRequest to avoid indefinite retrying
    // - keep a modest connectTimeout
    // - lazyConnect so we don't block startup, but commands will fail fast when disconnected
    redis = new Redis(REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      // 0 or 1: keep retries minimal — requests should fail fast
      maxRetriesPerRequest: 1,
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 2000),
      retryStrategy(times) {
        // small backoff for background reconnect attempts; request paths won't wait on retries
        return Math.min(1000 * times, 2000);
      },
    });
    // swallow non-fatal errors here; we'll surface failures per-operation
    redis.on('error', () => {});
  } catch (e) {
    // will fallback to in-memory
    redis = null;
  }
}

// In-memory fallback store
const createInMemoryStore = () => {
  const store = new Map();
  return {
    async get(key) {
      const raw = store.get(key);
      if (!raw) return null;
      if (raw.expiresAt && raw.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return raw.value;
    },
    async set(key, value, ttlMs = 5000) {
      const expiresAt = ttlMs && ttlMs > 0 ? Date.now() + ttlMs : null;
      store.set(key, { value, expiresAt });
    },
    async del(key) {
      store.delete(key);
    },
    async keys(prefix = '*') {
      const out = [];
      for (const k of store.keys()) {
        out.push(k);
      }
      return out;
    },
    async entries() {
      return Array.from(store.entries());
    },
  };
};

const createRedisStore = (client) => {
  // Helper to bound async redis operations so request paths don't hang.
  const withTimeout = (p, ms = 500) => {
    let timer = null;
    return Promise.race([
      p,
      new Promise((_, rej) => {
        timer = setTimeout(() => {
          rej(new Error('redis_operation_timeout'));
        }, ms);
      }),
    ]).finally(() => clearTimeout(timer));
  };

  return {
    async get(key) {
      try {
        const raw = await withTimeout(client.get(key), Number(process.env.CACHE_OP_TIMEOUT_MS || 400));
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
            // best-effort delete; don't block request if delete fails
            try {
              await withTimeout(client.del(key), Number(process.env.CACHE_OP_TIMEOUT_MS || 400));
            } catch (_) {}
            return null;
          }
          return parsed.value;
        } catch {
          return null;
        }
      } catch (err) {
        // Redis unavailable or timed out — treat as cache miss to allow request flow to continue.
        return null;
      }
    },
    async set(key, value, ttlMs = 5000) {
      const payload = { value, expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : null };
      try {
        await withTimeout(client.set(key, JSON.stringify(payload)), Number(process.env.CACHE_OP_TIMEOUT_MS || 400));
        if (ttlMs && ttlMs > 0) {
          await withTimeout(client.pexpire(key, ttlMs), Number(process.env.CACHE_OP_TIMEOUT_MS || 400));
        }
      } catch (err) {
        // Surface failure to caller so dev diagnostics return 5xx and normal flows can decide.
        const e = new Error('redis_set_failed');
        e.cause = err;
        throw e;
      }
    },
    async del(key) {
      try {
        await withTimeout(client.del(key), Number(process.env.CACHE_OP_TIMEOUT_MS || 400));
      } catch (err) {
        const e = new Error('redis_del_failed');
        e.cause = err;
        throw e;
      }
    },
    async keys(pattern = '*') {
      const found = [];
      let cursor = '0';
      do {
        // eslint-disable-next-line no-await-in-loop
        let res;
        try {
          res = await withTimeout(client.scan(cursor, 'MATCH', pattern, 'COUNT', 100), Number(process.env.CACHE_OP_TIMEOUT_MS || 400));
        } catch (err) {
          // fail fast when scan cannot complete
          const e = new Error('redis_scan_failed');
          e.cause = err;
          throw e;
        }
        cursor = res[0];
        const keys = res[1] || [];
        found.push(...keys);
      } while (cursor !== '0');
      return found;
    },
    async entries() {
      const keys = await this.keys('*');
      const out = [];
      for (const k of keys) {
        // eslint-disable-next-line no-await-in-loop
        const v = await this.get(k);
        out.push([k, { value: v }]);
      }
      return out;
    },
  };
};

const inMemory = createInMemoryStore();

const cacheClient = redis ? createRedisStore(redis) : inMemory;

export default cacheClient;
