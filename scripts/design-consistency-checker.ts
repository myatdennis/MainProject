import fs from 'fs';
import path from 'path';

const BRAND_COLORS = [
  '#F28C1A', // Sunrise Orange
  '#E6473A', // Deep Red Accent
  '#2B84C6', // Signature Blue
  '#3BAA66', // Forest Green
  '#1E1E1E', // Charcoal Block
  '#F9F9F1', // Soft White
];
const BRAND_FONTS = ['Montserrat', 'Lato', 'Quicksand'];

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const colorRegex = /#[0-9A-Fa-f]{6}/g;
  const fontRegex = /(font-family:\s*['\"]?([\w\s,-]+)['\"]?)/g;
  const colors = Array.from(content.matchAll(colorRegex)).map(m => m[0]);
  const fonts = Array.from(content.matchAll(fontRegex)).map(m => m[2]);
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
          if (!BRAND_COLORS.includes(color)) {
            results.colorIssues.push({ file: fullPath, color });
          }
        }
        for (const font of fonts) {
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

if (require.main === module) {
  const root = process.argv[2] || path.join(__dirname, '../src');
  const report = checkConsistency(root);
  fs.writeFileSync(path.join(__dirname, 'design-consistency-report.json'), JSON.stringify(report, null, 2));
  console.log('Design Consistency Check Complete. See design-consistency-report.json for details.');
}
