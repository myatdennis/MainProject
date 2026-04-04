// Global safety net — prevent unhandled rejections/exceptions from silently killing the process on Railway
process.on('unhandledRejection', (reason, promise) => {
  console.error('[process] unhandledRejection', {
    reason: reason instanceof Error ? reason.stack : String(reason),
    promise: String(promise),
  });
  // Do NOT exit — log and continue so Railway doesn't cycle-crash
});

process.on('uncaughtException', (err, origin) => {
  console.error('[process] uncaughtException', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    origin,
  });
  // Do NOT exit — keep the process alive
});

import './server/index.js';
