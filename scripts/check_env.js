#!/usr/bin/env node
/**
 * check_env.js
 * Fails (exit 1) if required environment variables for production build are missing.
 * Adjust arrays below based on proxy mode or absolute URL mode.
 */

const mode = process.env.API_MODE || 'absolute'; // 'absolute' or 'proxy'

const requiredFrontendAbsolute = [
  'VITE_API_BASE_URL',
  'VITE_WS_URL'
];
const requiredFrontendProxy = [
  // Using Netlify proxy, omit VITE_API_BASE_URL; allow optional VITE_WS_URL if relying on /ws redirect
  'VITE_WS_URL'
];

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