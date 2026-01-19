const formatPayload = (level, message, meta = {}) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  return JSON.stringify(payload);
};

const emit = (level, message, meta) => {
  const line = formatPayload(level, message, meta);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
};

export const log = (level, message, meta) => emit(level, message, meta);
log.debug = (message, meta) => emit('debug', message, meta);
log.info = (message, meta) => emit('info', message, meta);
log.warn = (message, meta) => emit('warn', message, meta);
log.error = (message, meta) => emit('error', message, meta);

export default log;
