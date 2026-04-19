import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';

// Static scan to prevent direct client-side Supabase writes to protected tables.
// This test scans `src/` but excludes test files and server-side code.

const ROOT = join(process.cwd(), 'src');
const FORBIDDEN_PATTERNS = [
  /from\(\s*['\"]assignments['\"]/, 
  /from\(\s*['\"]course_assignments['\"]/, 
  /from\(\s*['\"]survey_assignments['\"]/
];

async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Exclude tests and server code from this static scan
      if (full.includes('__tests__') || full.includes('/test/') || full.includes('/server/')) continue;
      files.push(...(await listFiles(full)));
    } else if (entry.isFile()) {
      if (!full.match(/\.(ts|tsx|js|jsx)$/)) continue;
      // Exclude test files
      if (full.includes('__tests__') || full.includes('.test.')) continue;
      files.push(full);
    }
  }
  return files;
}

describe('static protected-table usage scan', () => {
  it('no direct supabase.from("assignments"|...) in client code', async () => {
    const files = await listFiles(ROOT);
    const hits: Array<{ file: string; line: number; snippet: string }> = [];
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pat of FORBIDDEN_PATTERNS) {
          if (pat.test(line)) {
            hits.push({ file, line: i + 1, snippet: line.trim() });
          }
        }
      }
    }
    if (hits.length) {
      const message = ['Found direct Supabase protected-table usage in client files:'];
      for (const h of hits) message.push(`${h.file}:${h.line} -> ${h.snippet}`);
      // Fail the test with a readable message
      throw new Error(message.join('\n'));
    }
    expect(hits.length).toBe(0);
  });
});
