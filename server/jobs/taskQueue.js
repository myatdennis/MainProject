import BullMQ from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../lib/logger.js';

const { Queue, Worker, QueueScheduler } = BullMQ;

const REDIS_URL = process.env.REDIS_URL || process.env.JOBS_REDIS_URL || null;
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 500,
  removeOnFail: 2000,
};

let redisConnection = null;
if (REDIS_URL) {
  redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  redisConnection.on('error', (error) => {
    logger.warn('queue_redis_error', { message: error?.message || String(error) });
  });
  redisConnection.on('connect', () => logger.info('queue_redis_connected'));
}

const queues = new Map();
const schedulers = new Map();
const processors = new Map();

const ensureQueue = (name) => {
  if (!queues.has(name)) {
    queues.set(
      name,
      new Queue(name, {
        connection: redisConnection,
      })
    );
  }
  return queues.get(name);
};

const ensureScheduler = (name) => {
  if (!schedulers.has(name)) {
    schedulers.set(
      name,
      new QueueScheduler(name, {
        connection: redisConnection,
      })
    );
  }
  return schedulers.get(name);
};

const runFallbackHandler = (name, payload) => {
  const handler = processors.get(name);
  if (!handler) {
    logger.warn('queue_fallback_missing_handler', { name });
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    setImmediate(async () => {
      try {
        const result = await handler(payload, null);
        resolve(result);
      } catch (error) {
        logger.error('queue_fallback_handler_failed', { name, message: error?.message || String(error) });
        reject(error);
      }
    });
  });
};

export const registerJobProcessor = (name, handler) => {
  processors.set(name, handler);
  if (!redisConnection) {
    logger.info('queue_processor_registered_fallback', { name });
    return;
  }
  ensureScheduler(name);
  new Worker(
    name,
    async (job) => {
      try {
        return await handler(job.data, job);
      } catch (error) {
        logger.error('queue_worker_failed', {
          name,
          jobId: job.id,
          message: error?.message || String(error),
        });
        throw error;
      }
    },
    { connection: redisConnection }
  );
  logger.info('queue_processor_registered', { name });
};

export const enqueueJob = async (name, payload = {}, options = {}) => {
  if (!redisConnection) {
    return runFallbackHandler(name, payload);
  }
  const queue = ensureQueue(name);
  const jobOptions = {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
    backoff: options.backoff || DEFAULT_JOB_OPTIONS.backoff,
  };
  return queue.add(name, payload, jobOptions);
};

export const hasQueueBackend = () => Boolean(redisConnection);

export default {
  enqueueJob,
  registerJobProcessor,
  hasQueueBackend,
};
