import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase, { supabaseEnv } from '../lib/supabaseClient.js';

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

const HEALTH_PROBE_TABLE = process.env.HEALTH_PROBE_TABLE || 'users';

const probeDatabase = async () => {
  if (!supabase) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: 'Supabase client is not configured on the server',
      configured: supabaseEnv?.configured || false,
    };
  }

  try {
    const { error } = await supabase
      .from(HEALTH_PROBE_TABLE)
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      return {
        ok: false,
        code: 'SUPABASE_QUERY_FAILED',
        message: error.message || 'Database query failed',
      };
    }

    return {
      ok: true,
      code: 'OK',
      table: HEALTH_PROBE_TABLE,
    };
  } catch (error) {
    return {
      ok: false,
      code: 'SUPABASE_ERROR',
      message: error instanceof Error ? error.message : String(error),
    };
  }
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

router.get(['/api/health/db', '/api/health/db/'], async (req, res) => {
  const dbStatus = await probeDatabase();
  const statusCode = dbStatus.ok ? 200 : 503;
  res.status(statusCode).json(
    buildHealthPayload({
      requestId: req.requestId || null,
      database: dbStatus,
    }),
  );
});

export default router;
