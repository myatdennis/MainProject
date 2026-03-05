#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { coursePayloadSchema } from '../server/validators/coursePayload.js';

const [,, inputPath] = process.argv;
if (!inputPath) {
  console.error('Usage: node scripts/validate-course-import.mjs path/to/file.json');
  process.exit(1);
}

const resolvedPath = resolve(process.cwd(), inputPath);
let json;
try {
  const contents = readFileSync(resolvedPath, 'utf-8');
  json = JSON.parse(contents);
} catch (error) {
  console.error(`Failed to read or parse JSON from ${resolvedPath}:`, error.message || error);
  process.exit(1);
}

const payloads = Array.isArray(json?.items) ? json.items : [json];
let hasErrors = false;

payloads.forEach((payload, index) => {
  const result = coursePayloadSchema.safeParse(payload);
  if (!result.success) {
    hasErrors = true;
    console.error(`\n❌ Item ${index + 1} failed validation:`);
    for (const issue of result.error.issues) {
      const path = issue.path.length ? issue.path.join('.') : '<root>';
      console.error(`  • Path: ${path}`);
      console.error(`    Code: ${issue.code}`);
      console.error(`    Message: ${issue.message}`);
    }
  }
});

if (hasErrors) {
  console.error('\nValidation failed. See details above.');
  process.exit(1);
}

console.log(`✅ Validation passed for ${payloads.length} item(s).`);
