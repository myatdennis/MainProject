const fs = require('fs');
const path = require('path');

const input = path.resolve(__dirname, '../exports/prod_schema.sql');
const out = path.resolve(__dirname, '../reports/table_inventory.csv');

const raw = fs.readFileSync(input, 'utf8');

const createTableRegex = /CREATE TABLE IF NOT EXISTS\s+"([^"]+)"\."([^"]+)"\s*\(([^;]*?)\);/gms;

const rows = [];
let m;
while ((m = createTableRegex.exec(raw)) !== null) {
  const schema = m[1];
  const table = m[2];
  const body = m[3];
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  // Count only lines that look like column defs (start with a quoted identifier or unquoted identifier)
  const columnLines = lines.filter(l => /^[\"'a-zA-Z_]/.test(l) && !/^CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY|\)/i.test(l));
  rows.push({ schema, table, column_count: columnLines.length });
}

const header = 'schema,table,column_count\n';
const csv = header + rows.map(r => `${r.schema},${r.table},${r.column_count}`).join('\n') + '\n';
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, csv, 'utf8');
console.log('Wrote', out, 'rows:', rows.length);
