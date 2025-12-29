#!/usr/bin/env node
import { spawn } from 'node:child_process';

const children = [];
const shell = true;

const startProcess = (label, command, args) => {
  const child = spawn(command, args, {
    env: process.env,
    stdio: 'inherit',
    shell,
  });
  child.__label = label;
  child.on('exit', (code, signal) => {
    console.log(`[dev-full] ${label} exited with code ${code ?? 'null'} signal ${signal ?? 'null'}`);
    // If one child exits, shut down the rest so the script can exit cleanly.
    cleanup();
    process.exit(code ?? 0);
  });
  children.push(child);
  return child;
};

const cleanup = () => {
  children.forEach((child) => {
    if (!child.killed) {
      try {
        child.kill('SIGINT');
      } catch {
        child.kill('SIGTERM');
      }
    }
  });
};

process.on('SIGINT', () => {
  console.log('\n[dev-full] Caught SIGINT, shutting down...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[dev-full] Caught SIGTERM, shutting down...');
  cleanup();
  process.exit(0);
});

console.log('[dev-full] Starting API server on port 8888...');
const serverProcess = startProcess('server', 'npm', ['run', 'start:server']);

serverProcess.stdout?.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(chunk);
  if (text.toLowerCase().includes('server listening') || text.toLowerCase().includes('using port')) {
    maybeStartVite();
  }
});

serverProcess.stderr?.on('data', (chunk) => {
  process.stderr.write(chunk);
});

let viteStarted = false;
const maybeStartVite = () => {
  if (viteStarted) return;
  viteStarted = true;
  console.log('[dev-full] Starting Vite dev server on port 5174...');
  startProcess('vite', 'npm', ['run', 'dev']);
};

// Fallback timer: start Vite after 2 seconds even if no log message was detected.
setTimeout(maybeStartVite, 2000);
