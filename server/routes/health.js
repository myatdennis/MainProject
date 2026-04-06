import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  supabaseAuthClient,
  isSupabaseConfigured,
  isSupabaseAuthConfigured,
} from '../lib/supabaseClient.js';
import { pool, getDatabaseConnectionInfo } from '../db.js';

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

const HEALTH_PROBE_TABLE = process.env.HEALTH_PROBE_TABLE || 'user_profiles';
const databaseConnectionInfo = getDatabaseConnectionInfo();

const probeDatabase = async () => {
  if (!databaseConnectionInfo.connectionStringDefined) {
    return {
      ok: false,
      code: 'DATABASE_URL_MISSING',
      message: 'Database connection string is not configured on the server',
      configured: false,
    };
  }

  let client = null;
  try {
    client = await pool.connect();
    await client.query('select 1');
    await client.query('begin');
    try {
      await client.query('create temp table if not exists health_write_probe (id integer) on commit drop');
      await client.query('insert into health_write_probe(id) values (1)');
    } finally {
      await client.query('rollback');
    }

    return {
      ok: true,
      code: 'OK',
      table: HEALTH_PROBE_TABLE,
      writable: true,
    };
  } catch (error) {
    return {
      ok: false,
      code: error?.code || 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : String(error),
      writable: false,
    };
  } finally {
    try {
      client?.release();
    } catch {
      // no-op
    }
  }
};

router.get(['/health', '/health/'], (_req, res) => {
  res.status(200).json(buildHealthPayload());
});

router.get(['/api/health', '/api/health/'], (req, res) => {
  const supabaseConfigured = isSupabaseConfigured();
  const supabaseAuthConfigured = isSupabaseAuthConfigured();
  const supabaseAuthClientReady = Boolean(supabaseAuthClient);
  res.status(200).json(
    buildHealthPayload({
      requestId: req.requestId || null,
      supabaseConfigured,
      supabaseAuthConfigured,
      supabaseAuthClientReady,
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
