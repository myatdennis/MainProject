#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');

const targetExtensions = new Set(['.js', '.mjs', '.cjs']);
const patterns = [
  {
    label: 'ReferenceError pattern',
    regex: /ReferenceError[^\\n]{0,120}is not defined/gi,
  },
  {
    label: 'missing export pattern',
    regex: /(does not provide an export named|has no exported member)/gi,
  },
];

const collectFiles = async (dir: string): Promise<string[]> => {
  const files: string[] = [];
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

const formatMatch = (content: string, index: number) => {
  const start = Math.max(0, index - 60);
  const end = Math.min(content.length, index + 120);
  return content.slice(start, end).replace(/\\s+/g, ' ').trim();
};

const run = async () => {
  try {
    await fs.access(distDir);
  } catch {
    console.warn('[guard:ref] dist folder missing. Run `npm run build` before this guard.');
    process.exit(0);
  }

  const files = await collectFiles(distDir);
  const failures: Array<{ file: string; label: string; excerpt: string }> = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.regex);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content))) {
        failures.push({
          file,
          label: pattern.label,
          excerpt: formatMatch(content, match.index),
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
