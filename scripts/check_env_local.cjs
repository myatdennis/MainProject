#!/usr/bin/env node
/*
 * Local environment validator. Ensures the Vite client and Express API are
 * configured with sane defaults before starting the dev server so we avoid
 * confusing connectivity bugs.
 */
import('dotenv').then(({ config }) => {
  config();
  runChecks();
}).catch((error) => {
  console.warn('[check_env_local] Unable to load dotenv:', error?.message);
  runChecks();
});

function runChecks() {
  const failures = [];
  const warnings = [];

  const port = process.env.PORT ? Number(process.env.PORT) : 8888;
  if (!Number.isFinite(port)) {
    failures.push('PORT must be a number (e.g., 8888).');
  }

  const parseFlag = (value, { defaultValue = false } = {}) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
  };

  const devFallbackEnabled = parseFlag(process.env.DEV_FALLBACK, { defaultValue: true });
  const websocketsEnabled = parseFlag(process.env.VITE_ENABLE_WS, { defaultValue: false });

  const apiBase = process.env.VITE_API_BASE_URL || '';
  if (!apiBase) {
    warnings.push('VITE_API_BASE_URL not set — dev server will rely on Vite proxy /api forwarding.');
  } else if (!apiBase.startsWith('http://')) {
    warnings.push(`VITE_API_BASE_URL normally uses http:// in dev, currently "${apiBase}".`);
  } else if (!apiBase.includes(String(port))) {
    warnings.push(`VITE_API_BASE_URL (${apiBase}) does not match PORT ${port}.`);
  }

  const wsUrl = process.env.VITE_WS_URL;
  const shouldRequireWsUrl = websocketsEnabled && !devFallbackEnabled;
  if (shouldRequireWsUrl && !wsUrl) {
    failures.push('VITE_WS_URL is required when VITE_ENABLE_WS=true and DEV_FALLBACK=false (e.g., ws://localhost:8888/ws).');
  } else if (wsUrl && !wsUrl.startsWith('ws://')) {
    warnings.push(`VITE_WS_URL should start with ws:// in dev, currently "${wsUrl}".`);
  } else if (!wsUrl && websocketsEnabled) {
    warnings.push('VITE_ENABLE_WS=true but VITE_WS_URL missing; websocket client will stay disabled.');
  }

  if (!process.env.DEV_FALLBACK) {
    warnings.push('DEV_FALLBACK is not set; defaulting to demo fallback=true.');
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push('Supabase credentials missing. Demo mode will be used.');
  }

  const summary = {
    PORT: port,
    VITE_API_BASE_URL: apiBase || '(proxying via Vite dev server)',
    VITE_WS_URL: wsUrl,
    DEV_FALLBACK: devFallbackEnabled,
    VITE_ENABLE_WS: websocketsEnabled,
  };

  if (warnings.length) {
    console.warn('[check_env_local] Warnings:');
    warnings.forEach((msg) => console.warn(`  - ${msg}`));
  }

  if (failures.length) {
    console.error('[check_env_local] Missing/invalid configuration:');
    failures.forEach((msg) => console.error(`  - ${msg}`));
    console.error('\nFix the above variables in your .env before running the dev server.');
    process.exit(1);
  }

  console.log('[check_env_local] Local environment looks good:', summary);
}
