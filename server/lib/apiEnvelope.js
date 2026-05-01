export const sendOk = (res, data = null, options = {}) => {
  const {
    status = 200,
    code = null,
    message = null,
    meta = undefined,
    details = undefined,
  } = options;

  const payload = {
    ok: true,
    data: data ?? null,
  };

  if (code) payload.code = code;
  if (message) payload.message = message;
  if (meta !== undefined) payload.meta = meta;
  if (details !== undefined) payload.details = details;

  return res.status(status).json(payload);
};

export const sendError = (res, status = 500, code = 'server_error', message = 'Request failed', details = undefined, meta = undefined) => {
  try {
    // Helpful debug: when org_id_required is returned, log request context and stack
    if (String(code) === 'org_id_required' || status === 400 && String(code).includes('org_id')) {
      try {
        const req = res && res.req ? res.req : null;
        console.error('[DEBUG sendError] org_id_required triggered', {
          path: req?.originalUrl || req?.url || null,
          method: req?.method || null,
          requestId: req?.requestId || null,
          userId: req?.user?.id || req?.user?.userId || null,
          stack: new Error().stack,
        });
      } catch (e) {
        // noop
      }
    }
  } catch (e) {
    // noop
  }
  const payload = {
    ok: false,
    error: {
      code,
      message,
    },
    code,
    message,
  };

  if (details !== undefined) {
    payload.error.details = details;
  }
  if (meta !== undefined) {
    payload.meta = meta;
  }
  if (details !== undefined) {
    payload.details = details;
  }

  return res.status(status).json(payload);
};

export default {
  sendOk,
  sendError,
};
