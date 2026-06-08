// Rasterize a Sunday icon SVG to PNG at a given width (square).
// Usage: node scripts/render-icon.mjs <svgPath> <width> <outPngPath>
// Uses @resvg/resvg-js (pure Rust, no system deps) — ImageMagick/librsvg are
// not reliable here for the gradient + stroke icons.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [svgPath, widthArg, outPath] = process.argv.slice(2);
if (!svgPath || !widthArg || !outPath) {
  console.error('usage: render-icon.mjs <svgPath> <width> <outPngPath>');
  process.exit(1);
}
const svg = readFileSync(svgPath, 'utf8');
const png = new Resvg(svg, { fitTo: { mode: 'width', value: Number(widthArg) } }).render().asPng();
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(`rendered ${outPath} @ ${widthArg}px`);
