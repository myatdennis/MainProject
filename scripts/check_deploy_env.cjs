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
  'JWT_SECRET',
  'COOKIE_DOMAIN'
];

const requiredClient = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  // One of these two is fine; preferring VITE_API_BASE_URL
  'VITE_API_BASE_URL'
];

function check(list) {
  const missing = list.filter((name) => !process.env[name] || String(process.env[name]).trim().length === 0);
  return missing;
}

console.log('Server environment check (production):');
let missing = check(requiredServer);
if (missing.length === 0) {
  console.log('  All required server environment variables appear set');
} else {
  console.warn('  Missing server environment variables:', missing.join(', '));
}

console.log('\nClient (Vite) environment check (Netlify/Vercel build):');
missing = check(requiredClient);
if (missing.length === 0) {
  console.log('  All required client environment variables appear set');
} else {
  console.warn('  Missing client environment variables:', missing.join(', '));
}

console.log(`\nTips:\n - Ensure server vars are set in Railway or your backend host. Do NOT put server-only keys in the frontend env vars.\n - Ensure client vars are set in Netlify/Vercel build environment (VITE_*).`);

// Optionally print non-sensitive values (booleans only)
console.log('\nSummary (boolean):');
console.log('  supabaseUrlPresent:', !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL);
console.log('  supabaseServiceRoleKeyPresent:', !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.SUPABASE_SERVICE_KEY);
console.log('  dbUrlPresent:', !!process.env.DATABASE_URL);
console.log('  jwtSecretPresent:', !!process.env.JWT_SECRET);
console.log('  cookieDomainPresent:', !!process.env.COOKIE_DOMAIN);
console.log('  viteApiBasePresent:', !!process.env.VITE_API_BASE_URL || !!process.env.VITE_API_URL);

process.exit(missing.length === 0 ? 0 : 1);
