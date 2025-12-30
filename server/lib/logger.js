const levelWeights = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const activeLevelWeight = levelWeights[envLevel] ?? levelWeights.info;

const serializeMeta = (meta = {}) => {
  if (!meta || typeof meta !== 'object') {
    return {};
  }
  const normalized = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      normalized[key] = {
        message: value.message,
        stack: value.stack,
        name: value.name,
      };
    } else if (value && typeof value === 'object' && 'error' in value && value.error instanceof Error) {
      normalized[key] = {
        ...value,
        error: {
          message: value.error.message,
          stack: value.error.stack,
          name: value.error.name,
        },
      };
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
};

const log = (level, message, meta) => {
  const levelWeight = levelWeights[level] ?? levelWeights.info;
  if (levelWeight > activeLevelWeight) return;
  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...serializeMeta(meta),
  };
  try {
    consoleMethod(JSON.stringify(entry));
  } catch {
    consoleMethod(`${entry.timestamp} [${level}] ${message}`);
  }
};

export const logger = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
  trace: (message, meta) => log('trace', message, meta),
};

export default logger;
