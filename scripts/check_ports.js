#!/usr/bin/env node
const { execSync } = require('child_process');

const ports = [8888, 5174];
let busy = false;

for (const port of ports) {
  try {
    const result = execSync(`lsof -iTCP:${port} -sTCP:LISTEN -n -P`, { stdio: 'pipe' }).toString();
    if (result.trim()) {
      console.warn(`\u26a0\ufe0f  Port ${port} is already in use!`);
      busy = true;
    }
  } catch (e) {
    // Port is free
  }
}

if (busy) {
  console.warn('\nPlease free the above ports before starting your servers.');
  process.exit(1);
} else {
  console.log('All required ports are free.');
}
