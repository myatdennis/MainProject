import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKENS_FILE = path.join(__dirname, '../src/styles/design-tokens.css');

function extractBrandColors(): string[] {
  try {
    const css = fs.readFileSync(TOKENS_FILE, 'utf8');
    const matches = css.match(/#[0-9A-Fa-f]{6}/g) ?? [];
    const unique = Array.from(new Set(matches.map(color => color.toLowerCase())));
    // Always allow black/white even if omitted from tokens for contrast helpers
    return Array.from(new Set([...unique, '#ffffff', '#000000']));
  } catch (error) {
    console.warn('Unable to read design tokens for color extraction:', error);
    return ['#ffffff', '#000000'];
  }
}

function extractFonts(): string[] {
  try {
    const css = fs.readFileSync(TOKENS_FILE, 'utf8');
    const fontRegex = /--font-[\w-]+:\s*([^;]+);/g;
    const fonts = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = fontRegex.exec(css))) {
      match[1]
        .split(',')
        .map(token => token.replace(/['"]/g, '').trim())
        .filter(Boolean)
        .forEach(font => fonts.add(font));
    }
    ['Inter', 'Montserrat', 'Lato', 'Quicksand', 'system-ui', 'sans-serif'].forEach(font => fonts.add(font));
    return Array.from(fonts);
  } catch (error) {
    console.warn('Unable to read design tokens for font extraction:', error);
    return ['Inter', 'system-ui', 'sans-serif'];
  }
}

const BRAND_COLORS = extractBrandColors();
const BRAND_FONTS = extractFonts();

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const colorRegex = /#[0-9A-Fa-f]{6}/g;
  const fontRegex = /font-family:\s*([^;]+);?/g;
  const colors = Array.from(content.matchAll(colorRegex)).map(m => m[0]);
  const fonts = Array.from(content.matchAll(fontRegex)).map(m => m[1].trim());
  return { colors, fonts };
}

function checkConsistency(rootDir: string) {
  const results: any = { colorIssues: [], fontIssues: [] };
  function walk(dir: string) {
    for (const file of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.css')) {
        const { colors, fonts } = scanFile(fullPath);
        for (const color of colors) {
          const lc = color.toLowerCase();
          if (!BRAND_COLORS.includes(lc)) {
            results.colorIssues.push({ file: fullPath, color });
          }
        }
        for (const font of fonts) {
          if (!font || font.startsWith('var(')) {
            continue;
          }
          if (!BRAND_FONTS.some(f => font.includes(f))) {
            results.fontIssues.push({ file: fullPath, font });
          }
        }
      }
    }
  }
  walk(rootDir);
  return results;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  const root = process.argv[2] || path.join(__dirname, '../src');
  const report = checkConsistency(root);
  fs.writeFileSync(path.join(__dirname, 'design-consistency-report.json'), JSON.stringify(report, null, 2));
  console.log('Design Consistency Check Complete. See design-consistency-report.json for details.');
}
