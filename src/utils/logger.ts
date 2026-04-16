const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

let currentLevel: Level = (import.meta.env?.PROD ? 'warn' : 'debug') as Level;

export function setLogLevel(level: Level) {
  currentLevel = level;
}

function shouldLog(level: Level) {
  return LEVELS[level] >= LEVELS[currentLevel];
}

export const logger = {
  debug: (...args: any[]) => {
    if (!shouldLog('debug')) return;
    // Keep debug quiet in production
    if (typeof console !== 'undefined' && console.debug) console.debug(...args);
  },
  info: (...args: any[]) => {
    if (!shouldLog('info')) return;
    if (typeof console !== 'undefined' && console.info) console.info(...args);
  },
  warn: (...args: any[]) => {
    if (!shouldLog('warn')) return;
    if (typeof console !== 'undefined' && console.warn) console.warn(...args);
  },
  error: (...args: any[]) => {
    if (!shouldLog('error')) return;
    if (typeof console !== 'undefined' && console.error) console.error(...args);
  },
  setLevel: setLogLevel,
};

export default logger;
export function log(level: 'info' | 'warn' | 'error', message: string, context?: any) {
  const ts = new Date().toISOString();
  const formattedMessage = `[${ts}] [${level}] ${message}`;
  if (level === 'error') {
    console.error(formattedMessage, context || '');
    return;
  }
  if (level === 'warn') {
    console.warn(formattedMessage, context || '');
    return;
  }
  if (import.meta.env.DEV) {
    console.info(formattedMessage, context || '');
  }
}
