import fs from 'fs';
import path from 'path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');

function read(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return '';
  }
}

const authenticatePath = path.join(ROOT, 'server', 'middleware', 'authenticate.js');
const e2ePath = path.join(ROOT, 'server', 'middleware', 'e2eBypass.js');
const enforcePath = path.join(ROOT, 'server', 'middleware', 'enforceSingleAuth.js');

let failed = false;

const authContent = read(authenticatePath);
const e2eContent = read(e2ePath);
const enforceContent = read(enforcePath);

if (!authContent.includes('finalizeUser(')) {
  console.error('\u274c authenticate.js does not call finalizeUser when assigning req.user');
  failed = true;
}

if (!e2eContent.includes('finalizeUser(')) {
  console.error('\u274c e2eBypass.js does not call finalizeUser when assigning req.user');
  failed = true;
}

if (!enforceContent.includes('isFinalizedUser')) {
  console.error('\u274c enforceSingleAuth.js does not import/use isFinalizedUser');
  failed = true;
}

// Detect BREAK_AUTH_TEST left over
const files = fs.readdirSync(path.join(ROOT, 'server'), { withFileTypes: true });
function walk(dir) {
  let out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}

const allServerFiles = walk(path.join(ROOT, 'server'));
for (const f of allServerFiles) {
  const c = read(f);
  if (c.includes('BREAK_AUTH_TEST')) {
    console.error(`\u274c Found BREAK_AUTH_TEST in ${f}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('\u2705 Auth invariants look good');
