import express from 'express';

const router = express.Router();

export const buildSimpleHealthPayload = () => ({
  ok: true,
  service: 'mainproject',
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development',
});

export const healthHandler = (_req, res) => {
  res
    .status(200)
    .json(buildSimpleHealthPayload());
};

['/health', '/health/', '/api/health', '/api/health/'].forEach((path) => {
  router.get(path, healthHandler);
});

export default router;
