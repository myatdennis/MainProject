#!/usr/bin/env node
// Print Vite env values used by the frontend build
console.log('VITE_SUPABASE_URL:', !!process.env.VITE_SUPABASE_URL ? process.env.VITE_SUPABASE_URL : '(not set)');
console.log('VITE_SUPABASE_ANON_KEY:', !!process.env.VITE_SUPABASE_ANON_KEY ? '(present)' : '(not set)');
console.log('VITE_API_BASE_URL:', !!process.env.VITE_API_BASE_URL ? process.env.VITE_API_BASE_URL : '(not set)');
console.log('VITE_API_URL:', !!process.env.VITE_API_URL ? process.env.VITE_API_URL : '(not set)');
console.log('NODE_ENV:', process.env.NODE_ENV || '(not set)');

// Also print the build-time react version from package.json
try {
  const pkg = JSON.parse(require('fs').readFileSync(require('path').join(process.cwd(), 'package.json'), 'utf8'));
  console.log('react version in package.json:', pkg.dependencies?.react || pkg['react'] || '(not present)');
} catch (err) { console.warn('Failed to read package.json'); }
