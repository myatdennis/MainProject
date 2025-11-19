#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const envFile = path.resolve(process.cwd(), '.env.local');
let content = '';
if (fs.existsSync(envFile)) {
  content = fs.readFileSync(envFile, 'utf8');
} else if (fs.existsSync(path.resolve(process.cwd(), '.env'))) {
  content = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
}

const m = (k) => {
  const re = new RegExp('^' + k + "=(.*)$", 'm');
  const r = content.match(re);
  return r ? r[1].trim() : null;
};

const base = m('VITE_API_BASE_URL');
const url = m('VITE_API_URL');

function looksLikeRemote(h) {
  if (!h) return false;
  const l = h.toLowerCase();
  if (l.startsWith('http://localhost') || l.startsWith('http://127.') || l.startsWith('http://[::1]') || l === '') return false;
  if (l.startsWith('https://localhost') || l.startsWith('https://127.') || l.startsWith('https://[::1]')) return false;
  return true;
}

let problems = 0;
if (looksLikeRemote(base)) {
  console.error('[env-guard] VITE_API_BASE_URL appears to be set to a remote host:', base);
  problems++;
}
if (looksLikeRemote(url)) {
  console.error('[env-guard] VITE_API_URL appears to be set to a remote host:', url);
  problems++;
}

if (problems > 0) {
  console.error('\nIf you are developing locally, set these to blank or use the Vite proxy:\n  VITE_API_BASE_URL=\n  VITE_API_URL=\n');
  process.exit(1);
}

console.log('[env-guard] OK — VITE_API_* not pointing to remote host (or are empty)');
