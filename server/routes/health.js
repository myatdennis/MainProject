import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const startedAt = Date.now();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.resolve(__dirname, '../../package.json');

let packageVersion = '0.0.0-dev';
try {
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkgJson?.version) {
    packageVersion = pkgJson.version;
  }
} catch (error) {
  console.warn('[health] Unable to read package.json version:', error?.message || error);
}

const buildHealthPayload = (overrides = {}) => {
  const timestamp = new Date().toISOString();
  return {
    ok: true,
    env: process.env.NODE_ENV || 'development',
    time: timestamp,
    timestamp,
    version: packageVersion,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    ...overrides,
  };
};

router.get(['/health', '/health/'], (_req, res) => {
  res.status(200).json(buildHealthPayload());
});

router.get(['/api/health', '/api/health/'], (req, res) => {
  res.status(200).json(
    buildHealthPayload({
      requestId: req.requestId || null,
    }),
  );
});

export default router;
