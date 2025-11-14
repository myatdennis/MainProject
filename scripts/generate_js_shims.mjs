import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, 'src', 'pages');

function walk(dir) {
  const list = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      list.push(...walk(full));
    } else {
      list.push(full);
    }
  }
  return list;
}

function makeShimFor(file) {
  const ext = path.extname(file);
  if (!['.tsx', '.ts', '.jsx', '.mjs'].includes(ext)) return;
  const jsPath = file.replace(/\.[^.]+$/, '.js');
  if (fs.existsSync(jsPath)) return; // don't overwrite existing .js

  const rel = './' + path.basename(jsPath);
  // Determine import target extension
  const targetExt = ext;
  const targetBase = './' + path.basename(file);
  const content = `// Auto-generated shim: re-export ${path.basename(file)}\nexport { default } from '${targetBase}';\n`;
  fs.writeFileSync(jsPath, content, 'utf8');
  console.log('wrote shim:', path.relative(ROOT, jsPath));
}

function main() {
  if (!fs.existsSync(PAGES_DIR)) {
    console.error('pages dir not found:', PAGES_DIR);
    process.exit(1);
  }
  const files = walk(PAGES_DIR);
  for (const f of files) {
    try { makeShimFor(f); } catch (e) { console.error('err', f, e); }
  }
}

main();
