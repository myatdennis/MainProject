import fs from 'fs/promises';
import path from 'path';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const FORBIDDEN_PATTERNS = [".from('assignments'", 'from("assignments"', ".from(`assignments`", ".from('course_assignments'", '.from("course_assignments"', '.from(`course_assignments`', ".from('survey_assignments'", '.from("survey_assignments"'];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    const res = path.resolve(dir, ent.name);
    if (ent.isDirectory()) {
      files.push(...(await walk(res)));
    } else if (ent.isFile() && /\.(ts|tsx|js|jsx|mjs)$/.test(ent.name)) {
      files.push(res);
    }
  }
  return files;
}

async function main() {
  try {
    const files = await walk(SRC_DIR);
    const violations = [];
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (content.includes(pattern)) {
          violations.push({ file, pattern });
        }
      }
    }
    if (violations.length) {
      console.error('[check_forbidden_assign_mutation] Found forbidden direct assignment-table mutations in client code:');
      violations.forEach((v) => console.error(`  - ${v.file}: contains ${v.pattern}`));
      process.exit(2);
    }
    console.info('[check_forbidden_assign_mutation] OK — no forbidden patterns found in src/');
  } catch (err) {
    console.error('check_forbidden_assign_mutation failed', err);
    process.exit(1);
  }
}

main();
