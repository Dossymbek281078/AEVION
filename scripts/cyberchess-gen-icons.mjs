// CyberChess — generate PNG icons from SVG via sharp (from frontend/node_modules)
// Usage: node scripts/cyberchess-gen-icons.mjs
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const root = resolve(import.meta.dirname || ".", "..");
const require = createRequire(resolve(root, "frontend/package.json"));
const sharp = require("sharp");

const svgPath = resolve(root, "frontend/public/icons/cyberchess.svg");
const outDir = resolve(root, "frontend/public/icons");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const svg = readFileSync(svgPath);

const baseSizes = [72, 96, 128, 192, 512];
const shortcuts = ["play", "puzzles", "coach", "daily"];

const tasks = [
  ...baseSizes.map(size => ({
    out: resolve(outDir, `cyberchess-${size}.png`),
    size,
  })),
  ...shortcuts.map(name => ({
    out: resolve(outDir, `cyberchess-shortcut-${name}.png`),
    size: 96,
  })),
];

const results = [];
for (const t of tasks) {
  try {
    await sharp(svg).resize(t.size, t.size).png({ compressionLevel: 9 }).toFile(t.out);
    results.push(`✓ ${t.out.replace(root + "\\", "").replace(root + "/", "")} (${t.size}×${t.size})`);
  } catch (e) {
    results.push(`✗ ${t.out}: ${e.message}`);
  }
}

console.log(results.join("\n"));
console.log(`\n${tasks.length} icons generated.`);
