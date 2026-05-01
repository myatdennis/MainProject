import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const ALLOWED = [
  path.join(ROOT, 'server', 'middleware', 'authenticate.js'),
  path.join(ROOT, 'server', 'middleware', 'e2eBypass.js'),
];

// Ensure these allowed files use finalizeUser when assigning req.user
const MUST_FINALIZE = [
  path.join(ROOT, 'server', 'middleware', 'authenticate.js'),
  path.join(ROOT, 'server', 'middleware', 'e2eBypass.js'),
];

function walk(dir) {
  let results = [];
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.mjs') || file.endsWith('.cjs')) {
      results.push(full);
    }
  }
  return results;
}

function isAllowed(file) {
  for (const a of ALLOWED) {
    if (path.resolve(file) === path.resolve(a)) return true;
  }
  // allow tests
  if (file.includes(path.join('server', 'lib')) || file.includes('.test') || file.includes('__tests__')) return true;
  return false;
}

function report(file, line, col, src) {
  console.error(`\u274c Forbidden req.user mutation in ${file}:${line}:${col} -> ${src}`);
}

function checkFile(file) {
  if (isAllowed(file)) return false;
  const content = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  const scriptKind = ext === '.ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, /*setParentNodes*/ true, scriptKind);
  let found = false;

  function visit(node) {
    // Look for assignments where left is req.user or a property of it
    if (ts.isBinaryExpression(node) && node.operatorToken && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = node.left;
      if (ts.isPropertyAccessExpression(left)) {
        const exprText = left.expression.getText(sourceFile);
        if (exprText === 'req.user') {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          report(file, pos.line + 1, pos.character + 1, node.getText(sourceFile));
          found = true;
          return;
        }
      }
      if (ts.isIdentifier(left) && left.getText(sourceFile) === 'req.user') {
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        report(file, pos.line + 1, pos.character + 1, node.getText(sourceFile));
        found = true;
        return;
      }
    }

    // detect push/pop via property access e.g., req.user.memberships.push(...)
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const fullExpr = callee.expression.getText(sourceFile);
        if (fullExpr.startsWith('req.user')) {
          const propName = callee.name.getText(sourceFile);
          if (['push', 'pop', 'splice', 'shift', 'unshift'].includes(propName)) {
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            report(file, pos.line + 1, pos.character + 1, node.getText(sourceFile));
            found = true;
            return;
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function checkFinalizeUsage(file) {
  // For each MUST_FINALIZE file, ensure finalizeUser is referenced
  if (!MUST_FINALIZE.includes(path.resolve(file))) return false;
  const content = fs.readFileSync(file, 'utf8');
  return !content.includes('finalizeUser(');
}

function main() {
  const serverDir = path.join(ROOT, 'server');
  if (!fs.existsSync(serverDir)) {
    console.log('\u2705 No server directory found; skipping check.');
    return process.exit(0);
  }
  const files = walk(serverDir);
  let any = false;
  for (const f of files) {
    const r = checkFile(f);
    if (r) any = true;
  }
  if (any) {
    console.error('\nFound forbidden req.user mutations. Only authenticate.js and e2eBypass.js may assign req.user.');
    process.exit(1);
  }
  console.log('\u2705 No req.user mutations found outside allowed files');
}

main();
