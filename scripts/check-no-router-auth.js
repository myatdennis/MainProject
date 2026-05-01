import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..', 'server');

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

function reportAndExit(file, line, col) {
  console.error(`❌ Forbidden router-level auth found in: ${file}:${line}:${col}`);
  process.exitCode = 1;
}

function checkFile(file) {
  const content = fs.readFileSync(file, 'utf8');

  const ext = path.extname(file).toLowerCase();
  const scriptKind = ext === '.ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, /*setParentNodes*/ true, scriptKind);

  let found = false;

  function visit(node) {
    // detect router.use(...)
    if (ts.isCallExpression(node)) {
      const callee = node.expression;

      // router.use(...) via dot access
      if (ts.isPropertyAccessExpression(callee)) {
        const propName = callee.name && callee.name.getText(sourceFile);
        const objText = callee.expression && callee.expression.getText(sourceFile);
        if (propName === 'use' && objText === 'router') {
          // check args for identifier named 'authenticate'
          for (const arg of node.arguments) {
            if (ts.isIdentifier(arg) && arg.text === 'authenticate') {
              const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
              reportAndExit(file, pos.line + 1, pos.character + 1);
              found = true;
              return;
            }
          }
        }
      }

      // router['use'](...) via element access
      if (ts.isElementAccessExpression(callee)) {
        const obj = callee.expression && callee.expression.getText(sourceFile);
        const argExpr = callee.argumentExpression;
        const propLiteral = argExpr && (ts.isStringLiteral(argExpr) ? argExpr.text : null);
        if (obj === 'router' && propLiteral === 'use') {
          for (const arg of node.arguments) {
            if (ts.isIdentifier(arg) && arg.text === 'authenticate') {
              const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
              reportAndExit(file, pos.line + 1, pos.character + 1);
              found = true;
              return;
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.log(`✅ No server directory found at ${ROOT}; nothing to check.`);
    return;
  }

  const files = walk(ROOT);

  let any = false;
  for (const f of files) {
    const r = checkFile(f);
    if (r) any = true;
  }

  if (any) {
    // report already emitted
    process.exit(1);
  }

  console.log('✅ No router-level auth misuse found');
}

main();
