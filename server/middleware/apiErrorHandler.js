import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';
import { writeErrorDiagnostics } from '../utils/errorDiagnostics.js';

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

  const status = Number.isInteger(err?.status)
    ? err.status
    : Number.isInteger(err?.statusCode)
      ? err.statusCode
      : 500;
  const isInternalError = status >= 500;
  const code = typeof err?.code === 'string' ? err.code : isInternalError ? 'INTERNAL' : 'REQUEST_FAILED';
  const requestId = req?.requestId || createRequestId();
  if (!req.requestId) {
    req.requestId = requestId;
  }
  if (!res.headersSent) {
    res.setHeader('x-request-id', requestId);
  }

  const method = req?.method || 'UNKNOWN';
  const path = req?.originalUrl || req?.url || req?.path || 'UNKNOWN';
  const logPayload = {
    requestId,
    method,
    path,
    status,
    code,
  };

  if (isInternalError) {
    logger.error('api_error', { ...logPayload, error: err instanceof Error ? err.message : err, stack: err?.stack });
  } else {
    logger.warn('api_error', { ...logPayload, error: err instanceof Error ? err.message : err });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[apiError] requestId=${requestId}`, err);
  }

  if (isInternalError) {
    writeErrorDiagnostics(req, err, { code, status });
  }

  if (res.headersSent) {
    return next(err);
  }

  const message = isInternalError ? 'Internal server error' : err?.message || 'Request failed';
  const wantsJson = typeof req?.headers?.accept === 'string' && req.headers.accept.includes('application/json');
  if (wantsJson) {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    
  }

  const payload = JSON.stringify({
    status: 'error',
    code,
    message,
    requestId,
  });
  res.statusCode = status;
  res.end(payload);
};
