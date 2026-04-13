#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

const files = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b));

const classifyRisk = (file) => {
  const normalized = file.toLowerCase();
  if (normalized.includes('placeholder')) return 'placeholder';
  if (/(fix|restore|repair|harden|followup|alignment|dedup|linter)/i.test(normalized)) return 'repair';
  return 'canonical';
};

const descriptiveName = (file) => file.replace(/^\d+_/, '').replace(/\.sql$/, '');

const duplicateNameCounts = files.reduce((acc, file) => {
  const key = descriptiveName(file);
  acc.set(key, (acc.get(key) ?? 0) + 1);
  return acc;
}, new Map());

const report = files.map((file) => {
  const contents = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  const risk = classifyRisk(file);
  const duplicateName = duplicateNameCounts.get(descriptiveName(file)) > 1;
  const lineCount = contents.split('\n').length;
  const createsIndex = /create\s+(unique\s+)?index/gi.test(contents);
  const altersRls = /(create|alter)\s+policy|enable\s+row\s+level\s+security|force\s+row\s+level\s+security/gi.test(contents);
  const altersFunctions = /create\s+or\s+replace\s+function/gi.test(contents);

  return {
    file,
    descriptiveName: descriptiveName(file),
    risk,
    duplicateName,
    lineCount,
    createsIndex,
    altersRls,
    altersFunctions,
  };
});

const placeholders = report.filter((entry) => entry.risk === 'placeholder');
const repairs = report.filter((entry) => entry.risk === 'repair');
const duplicates = report.filter((entry) => entry.duplicateName);

const markdown = [
  '# Migration Health Report',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Summary',
  '',
  `- Total migrations: ${report.length}`,
  `- Placeholder migrations: ${placeholders.length}`,
  `- Repair/hardening migrations: ${repairs.length}`,
  `- Duplicate descriptive names: ${new Set(duplicates.map((entry) => entry.descriptiveName)).size}`,
  '',
  '## Flags',
  '',
  ...(
    placeholders.length > 0
      ? placeholders.map((entry) => `- Placeholder: \`${entry.file}\``)
      : ['- No placeholder migrations detected.']
  ),
  ...(
    duplicates.length > 0
      ? [...new Set(duplicates.map((entry) => entry.descriptiveName))].map(
          (name) =>
            `- Duplicate intent: \`${name}\` in ${report.filter((entry) => entry.descriptiveName === name).map((entry) => `\`${entry.file}\``).join(', ')}`,
        )
      : ['- No duplicate migration intents detected.']
  ),
  '',
  '## Inventory',
  '',
  '| Migration | Risk | Indexes | RLS | Functions | Lines |',
  '| --- | --- | --- | --- | --- | ---: |',
  ...report.map(
    (entry) =>
      `| \`${entry.file}\` | ${entry.risk} | ${entry.createsIndex ? 'yes' : 'no'} | ${entry.altersRls ? 'yes' : 'no'} | ${entry.altersFunctions ? 'yes' : 'no'} | ${entry.lineCount} |`,
  ),
  '',
  '## Recommendation',
  '',
  '- Treat the latest non-placeholder migration set as canonical and stop adding placeholder files.',
  '- Collapse repeated repair intent into a documented baseline before launch-freeze.',
  '- Re-run live validation against Supabase once DNS connectivity is restored, because this report is file-based and does not certify runtime schema parity.',
  '',
];

process.stdout.write(`${markdown.join('\n')}\n`);
