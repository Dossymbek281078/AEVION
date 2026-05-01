#!/usr/bin/env node
'use strict';

/**
 * Post-build helper: copies CJS shim files (plain .js next to .ts) from
 * src/ into dist/. tsc doesn't pick up .js files when allowJs is off, so
 * we copy them explicitly. Add new shims to SHIMS as needed.
 */

const fs = require('fs');
const path = require('path');

const SHIMS = [
  'lib/qsignV2/dilithiumLoader.js',
];

const SRC_ROOT = path.join(__dirname, '..', 'src');
const DIST_ROOT = path.join(__dirname, '..', 'dist');

let copied = 0;
for (const rel of SHIMS) {
  const src = path.join(SRC_ROOT, rel);
  const dst = path.join(DIST_ROOT, rel);
  if (!fs.existsSync(src)) {
    console.warn('[copy-cjs-shims] missing source:', src);
    continue;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  copied += 1;
}
console.log(`[copy-cjs-shims] copied ${copied} shim file(s) into dist/`);
