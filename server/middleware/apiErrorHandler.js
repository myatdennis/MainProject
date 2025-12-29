import { randomUUID } from 'crypto';

const createRequestId = () => {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }
  return `req_${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const attachRequestId = (req, res, next) => {
  const headerId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'].trim() : '';
  const requestId = headerId || createRequestId();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

export const createHttpError = (status = 500, code = 'server_error', message) => {
  const error = new Error(message || code || 'Request failed');
  error.status = status;
  if (code) {
    error.code = code;
  }
  return error;
};

export const withHttpError = (err, status = 500, code = 'server_error') => {
  if (!(err instanceof Error)) {
    return createHttpError(status, code, typeof err === 'string' ? err : undefined);
  }
  if (typeof err.status !== 'number') {
    err.status = status;
  }
  if (!err.code && code) {
    err.code = code;
  }
  return err;
};

export const apiErrorHandler = (err, req, res, next) => {
  if (!err) {
    return next();
  }

  const status = typeof err.status === 'number' ? err.status : 500;
  const code = typeof err.code === 'string' ? err.code : status >= 500 ? 'server_error' : 'request_failed';
  const requestId = req.requestId || createRequestId();
  const message = status >= 500 ? 'Internal server error' : err.message || 'Request failed';

  const logPayload = {
    requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    code,
  };

  if (status >= 500) {
    console.error('[apiError]', logPayload, err);
  } else {
    console.warn('[apiError]', logPayload, err.message);
  }

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json({ error: code, message, requestId });
};
