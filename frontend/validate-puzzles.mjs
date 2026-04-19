#!/usr/bin/env node
/**
 * AEVION CyberChess — puzzles.json validator v1
 *
 * Usage:
 *   cd C:\Users\user\aevion-core\frontend\public
 *   node validate-puzzles.mjs
 *
 * Or from anywhere:
 *   node validate-puzzles.mjs C:\path\to\puzzles.json
 *
 * Checks performed per puzzle:
 *   1. FEN parses correctly
 *   2. sol[0] is a legal move in the starting FEN position
 *   3. Full solution sequence is all legal
 *   4. side field matches active color in FEN
 *   5. For goal: "Mate" — last move of sol gives actual checkmate
 *   6. For goal: "Mate" with mateIn N — solution length matches (2N - 1 plies if side-to-move mates)
 *   7. rating r is in reasonable range [100, 3500]
 *   8. Required fields present: fen, sol, name, r
 *
 * Output:
 *   - Console report with PASS / WARN / FAIL counts
 *   - puzzles-report.json with full details per puzzle
 *   - puzzles-fixed.json with auto-fixable issues patched (side field, missing mateIn)
 *
 * Exit codes:
 *   0 = all passed or only warnings
 *   1 = hard failures (illegal moves, bad FEN)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

// Try multiple strategies to load chess.js:
//   1. Standard ESM import (works if chess.js is in a package.json dep chain)
//   2. createRequire from CWD (picks up ./node_modules/chess.js)
//   3. Explicit file URL to local node_modules
let Chess;
async function loadChess() {
  // Strategy 1: plain import
  try { const m = await import("chess.js"); return m.Chess; } catch {}
  // Strategy 2: require from CWD
  try {
    const require = createRequire(resolve(process.cwd(), "package.json"));
    const m = require("chess.js");
    return m.Chess;
  } catch {}
  // Strategy 3: direct file URL probing in likely locations
  const candidates = [
    resolve(process.cwd(), "node_modules/chess.js/dist/esm/chess.js"),
    resolve(process.cwd(), "node_modules/chess.js/src/chess.ts"),
    resolve(process.cwd(), "../node_modules/chess.js/dist/esm/chess.js"),
    resolve(process.cwd(), "../frontend/node_modules/chess.js/dist/esm/chess.js"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try { const m = await import(pathToFileURL(p).href); return m.Chess; } catch {}
    }
  }
  return null;
}

Chess = await loadChess();
if (!Chess) {
  console.error("\n❌ chess.js not found.");
  console.error("   Run this from your frontend directory where chess.js is installed:");
  console.error("   cd C:\\Users\\user\\aevion-core\\frontend");
  console.error("   node public\\validate-puzzles.mjs\n");
  process.exit(2);
}

// Resolve puzzle file path
const argPath = process.argv[2];
const defaultPath = resolve(process.cwd(), "puzzles.json");
const altPath = resolve(process.cwd(), "public", "puzzles.json");
let puzzlePath;
if (argPath) puzzlePath = resolve(argPath);
else if (existsSync(defaultPath)) puzzlePath = defaultPath;
else if (existsSync(altPath)) puzzlePath = altPath;
else {
  console.error("\n❌ Could not find puzzles.json");
  console.error(`   Looked in: ${defaultPath}`);
  console.error(`   Also in:   ${altPath}`);
  console.error("   Pass path explicitly: node validate-puzzles.mjs C:\\path\\to\\puzzles.json\n");
  process.exit(2);
}

console.log(`\n📂 Loading: ${puzzlePath}\n`);

let puzzles;
try {
  const raw = readFileSync(puzzlePath, "utf8");
  puzzles = JSON.parse(raw);
} catch (e) {
  console.error(`❌ Failed to parse JSON: ${e.message}\n`);
  process.exit(2);
}

if (!Array.isArray(puzzles)) {
  console.error("❌ puzzles.json must be a JSON array\n");
  process.exit(2);
}

console.log(`Found ${puzzles.length} puzzles. Validating...\n`);

const report = [];
let pass = 0;
let warn = 0;
let fail = 0;
const fixed = [];

function tryMoveUci(chess, uci) {
  if (!uci || uci.length < 4) return null;
  const move = {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
  try {
    return chess.move(move);
  } catch {
    // chess.js v1 throws on illegal moves
    return null;
  }
}

for (let i = 0; i < puzzles.length; i++) {
  const p = puzzles[i];
  const issues = { fail: [], warn: [] };
  const patched = { ...p };

  // 1. Required fields
  if (!p.fen) issues.fail.push("missing fen");
  if (!Array.isArray(p.sol) || p.sol.length === 0) issues.fail.push("missing or empty sol");
  if (!p.name) issues.warn.push("missing name");
  if (typeof p.r !== "number") issues.warn.push("missing or non-numeric rating r");

  // 7. Rating range
  if (typeof p.r === "number" && (p.r < 100 || p.r > 3500)) {
    issues.warn.push(`rating ${p.r} outside [100, 3500]`);
  }

  // 2. FEN parses
  let chess;
  if (p.fen) {
    try {
      chess = new Chess(p.fen);
    } catch (e) {
      issues.fail.push(`invalid FEN: ${e.message}`);
    }
  }

  // 4. side matches active color
  if (chess && p.side) {
    const activeColor = p.fen.split(" ")[1];
    if (activeColor !== p.side) {
      issues.warn.push(`side="${p.side}" but FEN active color="${activeColor}"`);
      // auto-fix
      patched.side = activeColor;
    }
  } else if (chess && !p.side) {
    const activeColor = p.fen.split(" ")[1];
    if (activeColor === "w" || activeColor === "b") {
      patched.side = activeColor;
      issues.warn.push(`side missing — auto-set to "${activeColor}" from FEN`);
    }
  }

  // 3. Full solution is legal
  let solutionLegal = true;
  let lastMoveResult = null;
  if (chess && Array.isArray(p.sol) && p.sol.length > 0) {
    const testChess = new Chess(p.fen);
    for (let j = 0; j < p.sol.length; j++) {
      const result = tryMoveUci(testChess, p.sol[j]);
      if (!result) {
        issues.fail.push(`sol[${j}]="${p.sol[j]}" is illegal from position after ${j} moves`);
        solutionLegal = false;
        break;
      }
      lastMoveResult = { chess: testChess, moveNum: j };
    }
  }

  // 5 & 6. Mate goal checks
  if (p.goal === "Mate" && solutionLegal && lastMoveResult) {
    const isMate = lastMoveResult.chess.isCheckmate();
    if (!isMate) {
      issues.fail.push(`goal="Mate" but final position after sol is NOT checkmate`);
    } else {
      // Check mateIn matches
      // If solving side mates, solution has 2N-1 plies for mate-in-N (their moves + opponent responses)
      // BUT: simple puzzles often only list the solver's moves → len = N
      // Accept either convention but warn if mismatched
      if (typeof p.mateIn === "number" && p.mateIn > 0) {
        const solLen = p.sol.length;
        const expectedFull = 2 * p.mateIn - 1;
        const expectedShort = p.mateIn;
        if (solLen !== expectedFull && solLen !== expectedShort) {
          issues.warn.push(
            `mateIn=${p.mateIn} but sol has ${solLen} moves (expected ${expectedShort} or ${expectedFull})`
          );
        }
      } else if (!p.mateIn) {
        // Auto-infer mateIn from solution length (conservative: only for short, clean mates)
        if (p.sol.length === 1) {
          patched.mateIn = 1;
          issues.warn.push("mateIn missing — auto-set to 1 (sol has 1 move, gives mate)");
        }
      }
    }
  }

  // Verdict
  let status;
  if (issues.fail.length > 0) {
    status = "FAIL";
    fail++;
  } else if (issues.warn.length > 0) {
    status = "WARN";
    warn++;
    fixed.push(patched);
  } else {
    status = "PASS";
    pass++;
    fixed.push(p);
  }

  report.push({
    index: i,
    name: p.name || "(unnamed)",
    status,
    fail: issues.fail,
    warn: issues.warn,
  });

  // If failed, still include original in fixed output (can't auto-fix illegal moves)
  if (status === "FAIL") fixed.push(p);
}

// Print compact summary + details for FAIL/WARN
console.log("=".repeat(70));
console.log(`  ✓ PASS: ${pass}`);
console.log(`  ⚠ WARN: ${warn}`);
console.log(`  ✗ FAIL: ${fail}`);
console.log("=".repeat(70) + "\n");

const fails = report.filter((r) => r.status === "FAIL");
const warns = report.filter((r) => r.status === "WARN");

if (fails.length > 0) {
  console.log("✗ FAILURES (must fix manually):\n");
  for (const r of fails) {
    console.log(`  [${r.index}] ${r.name}`);
    for (const f of r.fail) console.log(`       → ${f}`);
  }
  console.log();
}

if (warns.length > 0 && warns.length <= 30) {
  console.log("⚠ WARNINGS (may be auto-fixed in puzzles-fixed.json):\n");
  for (const r of warns) {
    console.log(`  [${r.index}] ${r.name}`);
    for (const w of r.warn) console.log(`       → ${w}`);
  }
  console.log();
} else if (warns.length > 30) {
  console.log(`⚠ ${warns.length} warnings (too many to print — see puzzles-report.json)\n`);
}

// Write report files next to input
const outDir = dirname(puzzlePath);
const reportPath = resolve(outDir, "puzzles-report.json");
const fixedPath = resolve(outDir, "puzzles-fixed.json");

writeFileSync(reportPath, JSON.stringify(report, null, 2));
writeFileSync(fixedPath, JSON.stringify(fixed, null, 2));

console.log(`📄 Full report: ${reportPath}`);
console.log(`🔧 Auto-fixed: ${fixedPath}`);
console.log();

if (fail === 0 && warn === 0) {
  console.log("✅ All puzzles valid. No changes needed.\n");
} else if (fail === 0) {
  console.log(
    `💡 To apply auto-fixes: review puzzles-fixed.json, then replace puzzles.json with it.\n`
  );
} else {
  console.log(`❌ ${fail} puzzle(s) have hard failures that cannot be auto-fixed.\n`);
}

process.exit(fail > 0 ? 1 : 0);
