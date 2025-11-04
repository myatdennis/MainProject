import fs from 'fs';
import path from 'path';

// Canonical brand palette (lowercased for normalization)
const BRAND_COLORS = [
  '#de7b12', // Sunrise Orange
  '#d72638', // Deep Red Accent
  '#3a7dff', // Sky Blue
  '#228b22', // Forest Green
  '#1e1e1e', // Charcoal Block
  '#f9f9f1', // Soft White
  '#3f3f3f', // Slate text
  '#e4e7eb', // Mist border
  '#f4f5f7', // Cloud surface
  '#f6c87b', // Accent gold
];
const BRAND_FONTS = ['Inter', 'system-ui', 'sans-serif'];

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
          const lc = color.toLowerCase();
          if (!BRAND_COLORS.includes(lc)) {
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
