#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST = path.resolve(process.cwd(), 'dist', 'assets');
const WARN_JS_GZIP_KB = 300; // vendor max gz
const WARN_NON_VENDOR_JS_GZIP_KB = 150; // feature chunk max gz
const WARN_CSS_GZIP_KB = 120;

const isVendor = (name) => /vendor|node\-modules|vendor\-/.test(name);

const gzipSize = (buf) => zlib.gzipSync(buf, { level: zlib.constants.Z_BEST_COMPRESSION }).length;

function formatKB(bytes) {
  return (bytes / 1024).toFixed(2);
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error(`dist/assets not found at ${DIST}. Run vite build first.`);
    process.exit(2);
  }
  const files = fs.readdirSync(DIST).filter((f) => /\.(js|css)$/.test(f));
  let failures = 0;
  const rows = [];
  for (const f of files) {
    const full = path.join(DIST, f);
    const buf = fs.readFileSync(full);
    const gz = gzipSize(buf);
    const gzKB = parseFloat(formatKB(gz));
    const isJs = f.endsWith('.js');
    const isCss = f.endsWith('.css');
    let limit = Infinity;
    if (isJs) {
      limit = isVendor(f) ? WARN_JS_GZIP_KB : WARN_NON_VENDOR_JS_GZIP_KB;
    } else if (isCss) {
      limit = WARN_CSS_GZIP_KB;
    }
    const ok = gzKB <= limit;
    if (!ok) failures++;
    rows.push({ file: f, gzKB, limit, ok });
  }

  // Print report
  console.log('\nBundle size report (gzip KB):');
  for (const r of rows.sort((a,b) => b.gzKB - a.gzKB)) {
    const mark = r.ok ? '✓' : '✗';
    console.log(`${mark} ${r.file.padEnd(40)} ${r.gzKB.toFixed(2)} KB (limit ${r.limit} KB)`);
  }

  if (failures > 0) {
    console.error(`\n❌ Bundle size check failed: ${failures} file(s) exceed limits.`);
    process.exit(1);
  }
  console.log('\n✅ Bundle size check passed.');
}

main();
