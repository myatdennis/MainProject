import LRUCache from 'lru-cache';
import Redis from 'ioredis';
import { logger } from '../lib/logger.js';

const DEFAULT_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 60);
const MAX_MEMORY_KEYS = Number(process.env.CACHE_MAX_ITEMS || 1000);
const CACHE_NAMESPACE = process.env.CACHE_NAMESPACE || 'mainproject';
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_CACHE_URL || null;

const buildKey = (key) => `${CACHE_NAMESPACE}:${key}`;

let redisClient = null;
if (REDIS_URL) {
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  redisClient.on('error', (error) => {
    logger.warn('cache_redis_error', { message: error?.message || String(error) });
  });
  redisClient.on('connect', () => logger.info('cache_redis_connected'));
}

const memoryCache = new LRUCache({
  max: MAX_MEMORY_KEYS,
  ttl: DEFAULT_TTL_SECONDS * 1000,
});

const serialize = (value) => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    logger.warn('cache_serialize_failed', { message: error?.message || String(error) });
    return null;
  }
};

const deserialize = (payload) => {
  if (payload === null || payload === undefined) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
};

export const getCache = async (key) => {
  const namespaced = buildKey(key);
  if (redisClient) {
    try {
      const payload = await redisClient.get(namespaced);
      if (payload === null) return null;
      return deserialize(payload);
    } catch (error) {
      logger.warn('cache_redis_get_failed', { key, message: error?.message || String(error) });
    }
  }
  return memoryCache.get(namespaced) ?? null;
};

export const setCache = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const namespaced = buildKey(key);
  if (value === undefined) return;
  if (redisClient) {
    const payload = serialize(value);
    if (payload !== null) {
      try {
        await redisClient.set(namespaced, payload, 'EX', Math.max(1, ttlSeconds));
        return;
      } catch (error) {
        logger.warn('cache_redis_set_failed', { key, message: error?.message || String(error) });
      }
    }
  }
  memoryCache.set(namespaced, value, { ttl: ttlSeconds * 1000 });
};

export const deleteCache = async (key) => {
  const namespaced = buildKey(key);
  if (redisClient) {
    try {
      await redisClient.del(namespaced);
    } catch (error) {
      logger.warn('cache_redis_delete_failed', { key, message: error?.message || String(error) });
    }
  }
  memoryCache.delete(namespaced);
};

export const invalidateCacheKeys = async (keys = []) => {
  await Promise.all(keys.map((key) => deleteCache(key)));
};

export const withCache = async (key, factory, options = {}) => {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  if (ttlSeconds <= 0) {
    return factory();
  }

  const existing = await getCache(key);
  if (existing !== null) {
    return existing;
  }

  const fresh = await factory();
  if (fresh !== undefined && fresh !== null) {
    await setCache(key, fresh, ttlSeconds);
  }
  return fresh;
};

export const cacheStats = () => ({
  backend: redisClient ? 'redis' : 'memory',
  namespace: CACHE_NAMESPACE,
  defaultTTLSeconds: DEFAULT_TTL_SECONDS,
  memorySize: memoryCache.size,
});

export default {
  getCache,
  setCache,
  deleteCache,
  invalidateCacheKeys,
  withCache,
  cacheStats,
};
