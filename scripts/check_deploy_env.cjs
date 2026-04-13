#!/usr/bin/env node
/*
 * Simple environment validator script for deployment.
 * Checks for server and client environment variables that are commonly required for production.
 * Run: node scripts/check_deploy_env.cjs
 */

const requiredServer = ['SUPABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SUPABASE_JWT_SECRET'];
const requiredServerAnyOf = [
  ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_KEY'],
  ['DATABASE_POOLER_URL', 'SUPABASE_DB_POOLER_URL', 'SUPABASE_DB_URL', 'DATABASE_URL'],
];

const requiredClient = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_API_BASE_URL'];

const isNetlifyFrontendBuild =
  process.env.NETLIFY === 'true' ||
  (typeof process.env.CONTEXT === 'string' && process.env.CONTEXT.length > 0);

const forceFlag = String(process.env.FORCE_DEPLOY_ENV_CHECK || '').toLowerCase();

// If explicitly false → never strict.
// If explicitly true → always strict.
// Otherwise production-like builds fail hard by default. Local development can
// still opt out when needed.
const isRailwayDeployContext =
  Boolean(process.env.RAILWAY_TOKEN) ||
  Boolean(process.env.RAILWAY_PROJECT_ID) ||
  (process.env.RAILWAY_SERVICE_NAME || '').length > 0;
const isProductionRuntime = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const isCi = process.env.CI === 'true' || process.env.CI === '1';
const isProtectedDeployContext = isProductionRuntime || isCi || isNetlifyFrontendBuild || isRailwayDeployContext;
const shouldEnforceStrict =
  forceFlag === 'true' ||
  (forceFlag !== 'false' && isProtectedDeployContext);
const invokingScript = process.env.npm_lifecycle_event || '';
// Skip client-env validation only for server-only workflows or the Railway API service.
const skipClientValidation =
  String(process.env.SKIP_CLIENT_ENV_CHECK || '').toLowerCase() === 'true' ||
  ['build:server', 'start:server', 'start'].includes(invokingScript) ||
  // Railway API service only sets server-side env vars; skip client checks there.
  (process.env.RAILWAY_SERVICE_NAME || '').toLowerCase() === 'api';
const enforceClientStrict =
  !skipClientValidation &&
  (isNetlifyFrontendBuild || String(process.env.ENFORCE_CLIENT_ENV || '').toLowerCase() === 'true');

function check(list) {
  const missing = list.filter((name) => !process.env[name] || String(process.env[name]).trim().length === 0);
  return missing;
}

function checkAnyOf(groups) {
  return groups
    .filter((group) => group.every((name) => !process.env[name] || String(process.env[name]).trim().length === 0))
    .map((group) => group.join(' | '));
}

let missingServer = [];
if (isNetlifyFrontendBuild) {
  console.log('Skipping server env validation for Netlify frontend build.');
} else {
  console.log('Server environment check (production):');
  missingServer = [...check(requiredServer), ...checkAnyOf(requiredServerAnyOf)];
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
console.log(
  '  dbUrlPresent:',
  !!process.env.DATABASE_POOLER_URL ||
    !!process.env.SUPABASE_DB_POOLER_URL ||
    !!process.env.SUPABASE_DB_URL ||
    !!process.env.DATABASE_URL,
);
console.log('  jwtAccessSecretPresent:', !!process.env.JWT_ACCESS_SECRET);
console.log('  jwtRefreshSecretPresent:', !!process.env.JWT_REFRESH_SECRET);
console.log('  supabaseJwtSecretPresent:', !!process.env.SUPABASE_JWT_SECRET);
console.log('  viteApiBasePresent:', !!process.env.VITE_API_BASE_URL || !!process.env.VITE_API_URL);

const hasMissing = missingServer.length > 0 || (detectedMissingClient.length > 0 && !skipClientValidation);
const shouldFailServer = shouldEnforceStrict && missingServer.length > 0;
const shouldFailClient = enforceClientStrict && detectedMissingClient.length > 0;
if (shouldFailServer || shouldFailClient) {
  console.error('\nDeployment environment check failed (strict mode). Set FORCE_DEPLOY_ENV_CHECK=false to bypass locally.');
  process.exit(1);
}

if (hasMissing) {
  console.warn('\nMissing env vars detected in a non-production local context; continuing because strict enforcement is disabled.');
}

process.exit(0);
