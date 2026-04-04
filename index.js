let fatalShutdownScheduled = false;

const scheduleFatalShutdown = (type, payload = {}) => {
  if (fatalShutdownScheduled) {
    return;
  }
  fatalShutdownScheduled = true;
  console.error('[process] fatal_runtime_error', {
    type,
    ...payload,
  });
  process.exitCode = 1;
  setTimeout(() => {
    process.exit(1);
  }, 250).unref();
};

process.on('unhandledRejection', (reason, promise) => {
  scheduleFatalShutdown('unhandledRejection', {
    reason: reason instanceof Error ? reason.stack : String(reason),
    promise: String(promise),
  });
});

process.on('uncaughtException', (err, origin) => {
  scheduleFatalShutdown('uncaughtException', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    origin,
  });
});

import './server/index.js';
