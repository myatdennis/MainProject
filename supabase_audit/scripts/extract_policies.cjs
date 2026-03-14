const fs = require('fs');
const path = require('path');

const migDir = path.resolve(__dirname, '../../supabase/migrations');
const out = path.resolve(__dirname, '../reports/rls_policy_matrix.md');

const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql'));
const policyRegex = /(?:CREATE POLICY|create policy)\s+(?:"([^"]+)"|([\w_\-]+))(?:\s+ON\s+([^\s]+))?/i;

const rows = [];
for (const f of files) {
  const content = fs.readFileSync(path.join(migDir, f), 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const m = line.match(policyRegex);
    if (m) {
      const name = m[1] || m[2] || line;
      const on = m[3] || '';
      rows.push({ file: f, name, on, line: line });
    }
  }
}

let md = '# RLS Policy Matrix (extracted)\n\n';
md += 'This file lists CREATE POLICY occurrences found in supabase/migrations.\n\n';
md += '| migration | policy_name | on_clause | example_line |\n';
md += '|---|---|---|---|\n';
for (const r of rows) {
  md += `| ${r.file} | ${r.name} | ${r.on} | ${r.line.replace(/\|/g, '\\|')} |\n`;
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, md, 'utf8');
console.log('Wrote', out, 'policies:', rows.length);
