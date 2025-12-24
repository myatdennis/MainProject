#!/usr/bin/env node
/**
 * check_env.js
 * Fails (exit 1) if required environment variables for production build are missing.
 * Adjust arrays below based on proxy mode or absolute URL mode.
 */

const mode = process.env.API_MODE || 'absolute'; // 'absolute' or 'proxy'

const parseFlag = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const websocketsEnabled = parseFlag(process.env.VITE_ENABLE_WS, mode !== 'proxy');

const requiredFrontendAbsolute = [
  'VITE_API_BASE_URL'
];
const requiredFrontendProxy = [
  // Using Netlify proxy, omit VITE_API_BASE_URL entirely; WS URL optional unless flag enabled
];

if (websocketsEnabled) {
  requiredFrontendAbsolute.push('VITE_WS_URL');
  requiredFrontendProxy.push('VITE_WS_URL');
}

const requiredBackend = [
  'CORS_ALLOWED_ORIGINS'
];

const missing = [];

const check = (vars) => {
  for (const v of vars) {
    if (!process.env[v] || String(process.env[v]).trim() === '') {
      missing.push(v);
    }
  }
};

check(requiredBackend);
check(mode === 'proxy' ? requiredFrontendProxy : requiredFrontendAbsolute);

if (missing.length > 0) {
  console.error('[env-check] Missing required env vars:', missing.join(', '));
  process.exit(1);
} else {
  console.log('[env-check] All required environment variables present for mode:', mode);
}