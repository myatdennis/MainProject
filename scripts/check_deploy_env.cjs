#!/usr/bin/env node
/*
 * Simple environment validator script for deployment.
 * Checks for server and client environment variables that are commonly required for production.
 * Run: node scripts/check_deploy_env.cjs
 */

const requiredServer = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'COOKIE_DOMAIN',
];

const requiredClient = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_API_BASE_URL'];

const isNetlifyFrontendBuild =
  process.env.NETLIFY === 'true' ||
  (typeof process.env.CONTEXT === 'string' && process.env.CONTEXT.length > 0);

const forceFlag = String(process.env.FORCE_DEPLOY_ENV_CHECK || '').toLowerCase();

// If explicitly false → never strict.
// If explicitly true → always strict.
// Otherwise → strict only in CI, but NOT when this is a Railway deploy pipeline
// (server secrets live in Railway env, not in the CI build step).
const isRailwayDeployContext =
  Boolean(process.env.RAILWAY_TOKEN) ||
  Boolean(process.env.RAILWAY_PROJECT_ID) ||
  (process.env.RAILWAY_SERVICE_NAME || '').length > 0;
const shouldEnforceStrict =
  forceFlag === 'true' ||
  (forceFlag !== 'false' && (process.env.CI === 'true' || process.env.CI === '1') && !isRailwayDeployContext);
const invokingScript = process.env.npm_lifecycle_event || '';
// Skip client-env validation when invoked from a server-only build/start context,
// OR when the build is the Railway API service (which doesn't serve the frontend).
// 'build:client' is listed so that when the frontend static service runs it,
// ENFORCE_CLIENT_ENV=true can be set to turn strict checking back on.
const skipClientValidation =
  String(process.env.SKIP_CLIENT_ENV_CHECK || '').toLowerCase() === 'true' ||
  ['build:server', 'start:server', 'start', 'build', 'build:client', 'build:all'].includes(invokingScript) ||
  // Railway API service only sets server-side env vars; skip client checks there.
  (process.env.RAILWAY_SERVICE_NAME || '').toLowerCase() === 'api';
const enforceClientStrict =
  !skipClientValidation &&
  (isNetlifyFrontendBuild || String(process.env.ENFORCE_CLIENT_ENV || '').toLowerCase() === 'true');

function check(list) {
  const missing = list.filter((name) => !process.env[name] || String(process.env[name]).trim().length === 0);
  return missing;
}

let missingServer = [];
if (isNetlifyFrontendBuild) {
  console.log('Skipping server env validation for Netlify frontend build.');
} else {
  console.log('Server environment check (production):');
  missingServer = check(requiredServer);
  if (missingServer.length === 0) {
    console.log('  All required server environment variables appear set');
  } else {
    console.warn('  Missing server environment variables:', missingServer.join(', '));
  }
}

console.log('\nClient (Vite) environment check (Netlify/Vercel build):');
const detectedMissingClient = check(requiredClient);
if (detectedMissingClient.length === 0) {
  console.log('  All required client environment variables appear set');
} else {
  console.warn('  Missing client environment variables:', detectedMissingClient.join(', '));
  if (skipClientValidation) {
    console.warn('  (Client env validation skipped for local server workflows)');
  }
}

console.log(`\nTips:\n - Ensure server vars are set in Railway or your backend host. Do NOT put server-only keys in the frontend env vars.\n - Ensure client vars are set in Netlify/Vercel build environment (VITE_*).`);

// Optionally print non-sensitive values (booleans only)
console.log('\nSummary (boolean):');
console.log('  supabaseUrlPresent:', !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL);
console.log(
  '  supabaseServiceRoleKeyPresent:',
  !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.SUPABASE_SERVICE_KEY,
);
console.log('  dbUrlPresent:', !!process.env.DATABASE_URL);
console.log('  jwtAccessSecretPresent:', !!process.env.JWT_ACCESS_SECRET);
console.log('  jwtRefreshSecretPresent:', !!process.env.JWT_REFRESH_SECRET);
console.log('  cookieDomainPresent:', !!process.env.COOKIE_DOMAIN);
console.log('  viteApiBasePresent:', !!process.env.VITE_API_BASE_URL || !!process.env.VITE_API_URL);

const hasMissing = missingServer.length > 0 || (detectedMissingClient.length > 0 && !skipClientValidation);
const shouldFailServer = shouldEnforceStrict && missingServer.length > 0;
const shouldFailClient = enforceClientStrict && detectedMissingClient.length > 0;
if (shouldFailServer || shouldFailClient) {
  console.error('\nDeployment environment check failed (strict mode). Set FORCE_DEPLOY_ENV_CHECK=false to bypass locally.');
  process.exit(1);
}

if (hasMissing) {
  console.warn('\nMissing env vars detected but strict enforcement disabled; continuing.');
}

process.exit(0);
