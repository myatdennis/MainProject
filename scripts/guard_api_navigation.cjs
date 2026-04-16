#!/usr/bin/env node

/**
 * guard_api_navigation.cjs
 *
 * Blocks commits that accidentally include direct browser navigations to /api/*
 * endpoints (e.g., <a href="/api/..."> or form actions). Real API traffic must
 * go through apiRequest/apiClient helpers so credentials + headers are attached.
 */

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_DIR = path.resolve(process.cwd(), 'src');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const CHECKS = [
  {
    id: 'href',
    description: 'Anchor/link href pointing at /api/*',
    pattern: /href\s*=\s*(?:\{\s*)?[\'"\`]\/?api/, 
    suggestion: 'Use a UI route or call apiRequest()/apiClient() instead of linking directly to /api/*.',
  },
  {
    id: 'action',
    description: 'Form action posting directly to /api/*',
    pattern: /action\s*=\s*(?:\{\s*)?[\'"\`]\/?api/, 
    suggestion: 'Submit forms through React handlers that call apiRequest() so auth headers/cookies are included.',
  },
  {
    id: 'navigate',
    description: 'Router navigation helpers sending users to /api/*',
    pattern: /(navigate|router\.push|router\.replace)\s*\(\s*[\'"\`]\/?api/, 
    suggestion: 'Route users to SPA pages (e.g., /admin/organizations) and let the page load data via the API client.',
  },
  {
    id: 'location',
    description: 'window.location mutations targeting /api/*',
    pattern: /window\.location\.(href|assign|replace)\s*=\s*[\'"\`]\/?api/, 
    suggestion: 'Use fetch/axios with credentials instead of causing a top-level navigation to an API route.',
  },
];

const visitedFiles = [];
function collectSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(entryPath);
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      visitedFiles.push(entryPath);
    }
  }
}

collectSourceFiles(SOURCE_DIR);

let hasFailures = false;

for (const check of CHECKS) {
  const failures = [];
  for (const filePath of visitedFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (check.pattern.test(lines[lineIndex])) {
        failures.push({ filePath, lineNumber: lineIndex + 1, line: lines[lineIndex].trim() });
      }
    }
  }

  if (failures.length > 0) {
    hasFailures = true;
    console.error(`\n🚫 ${check.description}`);
    for (const failure of failures) {
      console.error(`${failure.filePath}:${failure.lineNumber}: ${failure.line}`);
    }
    console.error(`Suggestion: ${check.suggestion}\n`);
  }
}

if (hasFailures) {
  console.error('guard:api-nav failed. Replace direct /api/* navigations with apiRequest/apiClient calls.');
  process.exit(1);
}
