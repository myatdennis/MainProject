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
