#!/usr/bin/env node
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { spawnSync } from 'node:child_process';

dotenv.config();

const required = ['SUPABASE_URL', 'SUPABASE_JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[real-db-smoke] Missing required env: ${key}`);
    process.exit(1);
  }
}

const ORG_ID = process.env.SMOKE_RESOLVED_ORG_ID || 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8';
const ADMIN_USER_ID = process.env.SMOKE_RESOLVED_ADMIN_USER_ID || 'cba92aef-a244-4386-8be7-2b2edc5370c1';
const LEARNER_USER_ID = process.env.SMOKE_RESOLVED_LEARNER_USER_ID || '29104b4d-f6d0-4900-931b-82c5a1125a5d';
const ADMIN_EMAIL = process.env.SMOKE_RESOLVED_ADMIN_EMAIL || 'org-a-admin-1774994855@the-huddle.co';
const LEARNER_EMAIL = process.env.SMOKE_RESOLVED_LEARNER_EMAIL || 'autotest+1774805122@example.com';

const now = Math.floor(Date.now() / 1000);
const iss = `${String(process.env.SUPABASE_URL).replace(/\/+$/, '')}/auth/v1`;

const sign = ({ sub, email, role }) =>
  jwt.sign(
    {
      sub,
      email,
      aud: 'authenticated',
      iss,
      app_metadata: { provider: 'email', providers: ['email'], role },
      user_metadata: { role },
      iat: now,
      exp: now + 3600,
    },
    process.env.SUPABASE_JWT_SECRET,
    { algorithm: 'HS256' },
  );

const env = {
  ...process.env,
  SMOKE_ADMIN_BEARER_TOKEN: sign({ sub: ADMIN_USER_ID, email: ADMIN_EMAIL, role: 'admin' }),
  SMOKE_LEARNER_BEARER_TOKEN: sign({ sub: LEARNER_USER_ID, email: LEARNER_EMAIL, role: 'learner' }),
  SURVEY_SMOKE_API_BASE_URL: process.env.SURVEY_SMOKE_API_BASE_URL || 'http://127.0.0.1:3000',
  SURVEY_SMOKE_ORG_ID: ORG_ID,
  SURVEY_SMOKE_ADMIN_USER_ID: ADMIN_USER_ID,
  SURVEY_SMOKE_LEARNER_USER_ID: LEARNER_USER_ID,
  SMOKE_EXPECT_DB_BACKED: 'true',
};

console.log('[real-db-smoke] starting', {
  apiBase: env.SURVEY_SMOKE_API_BASE_URL,
  orgId: env.SURVEY_SMOKE_ORG_ID,
  adminUserId: ADMIN_USER_ID,
  learnerUserId: LEARNER_USER_ID,
});

const result = spawnSync('node', ['scripts/survey_assignment_smoke.mjs'], {
  env,
  stdio: 'inherit',
});

if ((result.status ?? 1) !== 0) {
  console.error('[real-db-smoke] failed', { status: result.status, signal: result.signal || null });
}

process.exit(result.status ?? 1);
