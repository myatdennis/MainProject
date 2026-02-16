#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const assetsDir = path.join(distDir, 'assets');

const targetExtensions = new Set(['.js', '.mjs', '.cjs']);
const patterns = [
  {
    label: 'ReferenceError pattern',
    regex: /ReferenceError[^]{0,160}is not defined/gi,
  },
  {
    label: '"is not defined" pattern',
    regex: /\b[\w$]+\s+is not defined\b/gi,
  },
  {
    label: 'TDZ pattern',
    regex: /Cannot access [^]{0,160} before initialization/gi,
  },
];

const collectFiles = async (dir) => {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (targetExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
};

const formatMatch = (content, index) => {
  const start = Math.max(0, index - 60);
  const end = Math.min(content.length, index + 120);
  return content.slice(start, end).replace(/\s+/g, ' ').trim();
};

const shouldIgnoreMatch = (label, excerpt) => {
  if (label === '"is not defined" pattern') {
    const allowListTokens = ['Symbol.', '`document` global'];
    if (allowListTokens.some((token) => excerpt.includes(token))) {
      return true;
    }
  }
  return false;
};

const run = async () => {
  try {
    await fs.access(assetsDir);
  } catch {
    console.warn('[guard:ref] dist/assets folder missing. Run `npm run build` before this guard.');
    process.exit(0);
  }

  const files = await collectFiles(assetsDir);
  const failures = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.regex);
      let match;
      while ((match = regex.exec(content))) {
        const excerpt = formatMatch(content, match.index);
        if (shouldIgnoreMatch(pattern.label, excerpt)) {
          continue;
        }
        failures.push({
          file,
          label: pattern.label,
          excerpt,
        });
      }
    }
  }

  if (failures.length > 0) {
    console.error('[guard:ref] Potential runtime issues detected:');
    failures.forEach((failure) => {
      console.error(`- ${failure.label} in ${path.relative(projectRoot, failure.file)} -> "${failure.excerpt}"`);
    });
    process.exit(1);
  } else {
    console.log('[guard:ref] No ReferenceError or missing export patterns detected.');
  }
};

run().catch((error) => {
  console.error('[guard:ref] Failed to scan build artifacts:', error);
  process.exit(1);
});
