const fs = require('fs');
const path = require('path');

const input = path.resolve(__dirname, '../exports/prod_schema.sql');
const out = path.resolve(__dirname, '../reports/table_inventory_detailed.csv');
const raw = fs.readFileSync(input, 'utf8');

const createTableRegex = /CREATE TABLE IF NOT EXISTS\s+"([^"]+)"\."([^"]+)"\s*\(([^;]*?)\);/gms;

const rows = [];
let m;
while ((m = createTableRegex.exec(raw)) !== null) {
  const schema = m[1];
  const table = m[2];
  const body = m[3];
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);

  // Extract column lines until we hit a constraint line
  for (const line of lines) {
    if (/^(CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY)/i.test(line)) break;
    // match "col" or col
    const colMatch = line.match(/^"?([a-zA-Z0-9_]+)"?\s+([^,]+),?$/);
    if (!colMatch) continue;
    const colName = colMatch[1];
    const rest = colMatch[2].trim();
    // detect nullability
    const nullable = /NOT NULL/i.test(rest) ? 'no' : 'yes';
    // detect default
    const defaultMatch = rest.match(/DEFAULT\s+([^\s]+)/i);
    const def = defaultMatch ? defaultMatch[1].replace(/,$/, '') : '';
    // detect PK in-line
    const isPk = /PRIMARY KEY/i.test(rest) ? 'yes' : 'no';
    // type: first token(s) before null/default
    let type = rest.split(/\s+NOT NULL|\s+NULL|\s+DEFAULT|\s+PRIMARY KEY/i)[0].trim();
    rows.push({ schema, table, column_name: colName, column_type: type, nullable, default: def, primary_key: isPk });
  }
}

const header = 'schema,table,column_name,column_type,nullable,default,primary_key\n';
const csv = header + rows.map(r => `${r.schema},${r.table},${r.column_name},"${r.column_type}",${r.nullable},"${r.default}",${r.primary_key}`).join('\n') + '\n';
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, csv, 'utf8');
console.log('Wrote', out, 'rows:', rows.length);
