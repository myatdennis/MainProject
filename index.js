process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] unhandledRejection', {
    reason: reason instanceof Error ? reason.stack : String(reason),
    promise: String(promise),
  });
});

process.on('uncaughtException', (err, origin) => {
  console.error('[FATAL] uncaughtException', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    origin,
  });
});

import './server/index.js';
