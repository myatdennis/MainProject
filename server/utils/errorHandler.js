import { log } from './logger.js';

export const handleError = (error, requestId = null) => {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = error?.code || 'internal_error';
  const safeMessage =
    typeof error?.message === 'string' && status < 500
      ? error.message
      : 'An unexpected error occurred. Please try again later.';

  log.error('server_error', {
    requestId,
    code,
    status,
    error: error instanceof Error ? error.stack || error.message : error,
  });

  return {
    status,
    code,
    message: safeMessage,
    request_id: requestId || null,
  };
};

export default handleError;
