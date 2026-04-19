#!/usr/bin/env node
/**
 * AEVION CyberChess — hotfix for 6 broken puzzles detected by validator.
 *
 * Fixes:
 *   [38] Queen Close Mate   — wrong sol, was d5d7. Real mate-in-1 is d5a8.
 *   [48] Queen Back Rank    — correct sol e2e8 but mateIn=2 wrong. It's mate-in-1.
 *   [50] Queen Penetration  — no mate exists. Convert to Best move (b5b8 wins rook).
 *   [64] Queen f2 Attack    — sol f6f2 wrong, no mate-in-2. Real mate-in-3 from Bc5.
 *   [73] Queen Takes g7     — no forced mate. Convert to Best move (d4g7 huge attack).
 *   [87] Rook + Bishop      — no forced mate. Convert to Best move (c1c8 decisive).
 *
 * Usage:
 *   cd C:\Users\user\aevion-core\frontend
 *   node fix-broken-puzzles.mjs public\puzzles.json
 *
 * Creates:
 *   public\puzzles.json.backup-<timestamp>
 *   public\puzzles.json           (patched in place)
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = process.argv[2] || "public/puzzles.json";
const abs = resolve(inputPath);

if (!existsSync(abs)) {
  console.error(`\n❌ File not found: ${abs}\n`);
  process.exit(1);
}

const puzzles = JSON.parse(readFileSync(abs, "utf8"));

if (!Array.isArray(puzzles)) {
  console.error("❌ Expected JSON array\n");
  process.exit(1);
}

// Backup first
const backupPath = abs + ".backup-" + Date.now();
copyFileSync(abs, backupPath);
console.log(`💾 Backup: ${backupPath}\n`);

// Patches by FEN (safer than by index — in case puzzle order changes)
const patches = [
  {
    matchFen: "4k3/8/4K3/3Q4/8/8/8/8 w - - 0 1",
    matchName: "Queen Close Mate",
    patch: {
      sol: ["d5a8"],
      mateIn: 1,
      theme: "Mate in 1",
    },
  },
  {
    matchFen: "6k1/pp4pp/8/8/8/8/PP2QPPP/6K1 w - - 0 1",
    matchName: "Queen Back Rank",
    patch: {
      mateIn: 1,
      theme: "Mate in 1",
    },
  },
  {
    matchFen: "r6k/6pp/8/1Q6/8/8/6PP/6K1 w - - 0 1",
    matchName: "Queen Penetration",
    patch: {
      goal: "Best move",
      theme: "Winning attack",
      mateIn: undefined, // remove field
    },
  },
  {
    matchFen: "r1b1kb1r/pppp1ppp/5q2/4n3/3KP3/2N3PN/PPP4P/R1BQ1B1R b kq - 0 1",
    matchName: "Queen f2 Attack",
    patch: {
      sol: ["f8c5", "d4c5", "f6b6", "c5d5", "b6d6"],
      mateIn: 3,
      theme: "Mate in 3",
    },
  },
  {
    matchFen: "r4rk1/ppp2ppp/8/8/1q1Q4/1B6/PPP2PPP/R4RK1 w - - 0 1",
    matchName: "Queen Takes g7",
    patch: {
      goal: "Best move",
      theme: "Attack on king",
      mateIn: undefined,
    },
  },
  {
    matchFen: "6k1/5p1p/8/8/8/4B3/5PPP/2R3K1 w - - 0 1",
    matchName: "Rook + Bishop",
    patch: {
      goal: "Best move",
      theme: "Decisive attack",
      mateIn: undefined,
    },
  },
];

let fixed = 0;
for (const patchDef of patches) {
  const idx = puzzles.findIndex(p => p.fen === patchDef.matchFen && p.name === patchDef.matchName);
  if (idx === -1) {
    console.log(`⚠ Not found: ${patchDef.matchName} — maybe already fixed?`);
    continue;
  }
  const before = JSON.stringify(puzzles[idx]);
  // Apply patch field-by-field
  for (const [k, v] of Object.entries(patchDef.patch)) {
    if (v === undefined) delete puzzles[idx][k];
    else puzzles[idx][k] = v;
  }
  const after = JSON.stringify(puzzles[idx]);
  if (before !== after) {
    console.log(`✓ [${idx}] ${patchDef.matchName}`);
    fixed++;
  }
}

writeFileSync(abs, JSON.stringify(puzzles));
console.log(`\n✅ Patched ${fixed} puzzles, wrote ${abs}\n`);
console.log(`💡 Now run:  node validate-puzzles.mjs public\\puzzles.json\n`);
console.log(`   Expected result: 159 PASS / 0 WARN / 0 FAIL\n`);
