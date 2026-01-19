#!/usr/bin/env node
import readline from 'readline';
import { spawn } from 'child_process';

const [, , migrationPath] = process.argv;
if (!migrationPath) {
  console.error('Usage: node scripts/run_migration_prompt.js <migration-file.sql>');
  process.exit(1);
}

const runWithEnv = (env) => {
  const child = spawn('node', ['scripts/run_migration.mjs', migrationPath], {
    stdio: 'inherit',
    env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
};

if (process.env.DATABASE_URL) {
  runWithEnv(process.env);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Enter DATABASE_URL: ', (answer) => {
    rl.close();
    if (!answer) {
      console.error('DATABASE_URL is required.');
      process.exit(1);
    }
    runWithEnv({ ...process.env, DATABASE_URL: answer });
  });
}
