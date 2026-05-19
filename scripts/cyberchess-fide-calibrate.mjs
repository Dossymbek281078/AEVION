#!/usr/bin/env node
/**
 * AEVION CyberChess — FIDE CPI calibration script.
 *
 * Standalone Node.js 18+ ESM script. No external dependencies.
 *
 * Reads a PGN corpus (Lichess Open DB GM filter / PGN Mentor master games /
 * any TWIC-style dump). For each (player, game) pair where WhiteElo / BlackElo
 * is present, derives proxy CPI metrics from PGN headers + moves
 * (without engine eval — approximation), then runs least-squares fit
 * against target FIDE Elo through closed-form normal equations.
 *
 * Writes `calibration-weights.json` consumable at runtime by the frontend
 * via `loadCalibratedWeights()` in `ratingCalibrationFit.ts`.
 *
 * Usage:
 *   node scripts/cyberchess-fide-calibrate.mjs \
 *     --pgn ./corpus.pgn \
 *     --output ./frontend/public/calibration-weights.json \
 *     --limit 5000
 *
 * NOTE: Production-grade fit would require per-move Stockfish eval to
 * compute true accuracy / blunder rate. The proxy metrics implemented
 * here give a rough baseline weight set good enough to seed estimation.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";

/* ────────────────────────────────────────────────────────────────────
 *  CLI args parsing
 * ──────────────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const args = { pgn: null, output: null, limit: Infinity };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pgn") args.pgn = argv[++i];
    else if (a === "--output") args.output = argv[++i];
    else if (a === "--limit") args.limit = Number(argv[++i]) || Infinity;
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/cyberchess-fide-calibrate.mjs --pgn <path> --output <path> [--limit N]"
      );
      process.exit(0);
    }
  }
  if (!args.pgn || !args.output) {
    console.error("ERROR: --pgn and --output are required. See --help.");
    process.exit(1);
  }
  return args;
}

/* ────────────────────────────────────────────────────────────────────
 *  PGN parsing (header regex + naive move stream)
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Split raw PGN dump into individual games. Each game is a chunk
 * separated by blank lines + game starts with [Event "..." header.
 */
function splitGames(raw) {
  // Normalize line endings
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const games = [];
  let current = [];
  let inMovesBlock = false;
  for (const line of lines) {
    if (line.startsWith("[Event ")) {
      // New game starts
      if (current.length > 0) {
        games.push(current.join("\n"));
      }
      current = [line];
      inMovesBlock = false;
    } else {
      current.push(line);
      if (line.trim() === "" && current.length > 5) inMovesBlock = true;
    }
  }
  if (current.length > 0) games.push(current.join("\n"));
  return games;
}

/**
 * Parse one PGN game into structured form.
 * Headers: regex `[Key "Value"]`
 * Moves: everything after the first blank line, stripped of comments/NAGs/results
 */
function parseGame(chunk) {
  const headers = {};
  const headerRe = /^\[(\w+)\s+"([^"]*)"\]/;
  const lines = chunk.split("\n");
  let movesStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headerRe);
    if (m) headers[m[1]] = m[2];
    else if (lines[i].trim() === "" && Object.keys(headers).length > 0 && movesStart < 0) {
      movesStart = i + 1;
      break;
    }
  }
  if (movesStart < 0) movesStart = lines.length;

  // Concatenate move lines, strip comments {…} and NAG $N and move numbers
  let movesText = lines.slice(movesStart).join(" ");
  movesText = movesText
    .replace(/\{[^}]*\}/g, " ") // strip comments
    .replace(/\([^)]*\)/g, " ") // strip variations
    .replace(/\$\d+/g, " ") // strip NAGs
    .replace(/\d+\.(\.\.)?/g, " ") // strip move numbers like "1." "1..."
    .replace(/\s+/g, " ")
    .trim();

  // Remove trailing result token (1-0 / 0-1 / 1/2-1/2 / *)
  movesText = movesText
    .replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, "")
    .trim();

  const moves = movesText.length > 0 ? movesText.split(/\s+/) : [];

  return { headers, moves };
}

/* ────────────────────────────────────────────────────────────────────
 *  Proxy CPI metric derivation per (player, game)
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Heuristic feature extraction. No engine — derived from PGN headers
 * and shallow move analysis.
 *
 * Returns one row per side (white & black), with their target FIDE Elo
 * and a feature vector for least-squares fit.
 */
function deriveRowsFromGame(g) {
  const whiteElo = parseInt(g.headers.WhiteElo, 10);
  const blackElo = parseInt(g.headers.BlackElo, 10);
  const result = g.headers.Result || "*";

  if (!Number.isFinite(whiteElo) && !Number.isFinite(blackElo)) return [];

  // result map: 1=white win, 0=black win, 0.5=draw
  let whiteScore = 0.5;
  if (result === "1-0") whiteScore = 1;
  else if (result === "0-1") whiteScore = 0;
  else if (result === "1/2-1/2") whiteScore = 0.5;
  else return []; // unknown / unfinished — skip

  const plyCount = g.moves.length;

  // ---- Opening theory depth: max ply where first 12 plies were
  // "book-like" (no captures, no checks). Proxy — count consecutive
  // non-capture, non-check plies from the start.
  let openingTheoryDepth = 0;
  for (let i = 0; i < Math.min(plyCount, 24); i++) {
    const mv = g.moves[i] || "";
    if (mv.includes("x") || mv.includes("+") || mv.includes("#")) break;
    openingTheoryDepth++;
  }
  // GM-level proxy: cap at 14 plies of theory
  openingTheoryDepth = Math.min(14, openingTheoryDepth);

  // ---- Tactical efficiency proxy: count captures + checks / total plies.
  // High density of tactics indicates calculation strength. Normalize 0..1.
  let captureCount = 0;
  let checkCount = 0;
  for (const mv of g.moves) {
    if (mv.includes("x")) captureCount++;
    if (mv.includes("+") || mv.includes("#")) checkCount++;
  }
  const tacticalEvents = captureCount + checkCount;
  const tacticalEfficiencyBase = plyCount > 0
    ? Math.min(1, tacticalEvents / Math.max(1, plyCount * 0.35))
    : 0.5;
  // Sacrifice pattern bump: queen sac (Qx) or rook sac followed by check
  let hasSacrifice = false;
  for (let i = 0; i < g.moves.length - 1; i++) {
    const m = g.moves[i];
    const next = g.moves[i + 1];
    if (/^[QR]x/.test(m) && next && (next.includes("+") || next.includes("#"))) {
      hasSacrifice = true;
      break;
    }
  }
  const tacticalEfficiency = Math.max(
    0,
    Math.min(1, tacticalEfficiencyBase + (hasSacrifice ? 0.2 : 0))
  );

  // ---- Endgame strength: reached >40 ply baseline. GM who converts long
  // games has high endgame strength.
  const reachedEndgame = plyCount > 40;
  const endgameBase = 0.5;
  const endgameBump = reachedEndgame ? 0.2 : 0;

  // Per-side rows: white & black get same opening / tactics but different
  // accuracy / blunder / endgame based on game result.
  const rows = [];

  if (Number.isFinite(whiteElo)) {
    rows.push({
      targetFide: whiteElo,
      features: featuresFor(whiteScore, openingTheoryDepth, tacticalEfficiency, endgameBase + endgameBump * (whiteScore >= 0.5 ? 1 : 0.4)),
      meta: { side: "white", plyCount, hasSacrifice }
    });
  }
  if (Number.isFinite(blackElo)) {
    const blackScore = 1 - whiteScore;
    rows.push({
      targetFide: blackElo,
      features: featuresFor(blackScore, openingTheoryDepth, tacticalEfficiency, endgameBase + endgameBump * (blackScore >= 0.5 ? 1 : 0.4)),
      meta: { side: "black", plyCount, hasSacrifice }
    });
  }

  return rows;
}

/**
 * Build feature vector for a single (player, game) row.
 * Order matches frontend `estimateFideFromCPI` formula:
 *   [accuracyPct, openingTheoryDepth, tacticalEfficiency, endgameStrength, blunderRate, avgMoveTime]
 *
 * Accuracy / blunder proxy derived from match result:
 *   win   → accuracy=95, blunder=0.0
 *   draw  → accuracy=85, blunder=0.05
 *   loss  → accuracy=72, blunder=0.10
 *
 * avgMoveTime: 30 default (GM corpus typically lacks clock times).
 */
function featuresFor(score, openingDepth, tactical, endgameStrength) {
  let accuracyPct, blunderRate;
  if (score === 1) {
    accuracyPct = 95;
    blunderRate = 0.0;
  } else if (score === 0.5) {
    accuracyPct = 85;
    blunderRate = 0.05;
  } else {
    accuracyPct = 72;
    blunderRate = 0.10;
  }
  return [
    accuracyPct,
    openingDepth,
    tactical,
    Math.min(1, endgameStrength),
    blunderRate,
    30 // avgMoveTime — default, GM corpus rarely has clocks
  ];
}

/* ────────────────────────────────────────────────────────────────────
 *  Least-squares fit via normal equations
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Solve (X^T X) β = X^T y for β using Gauss-Jordan elimination.
 * X is m×n (m samples, n features+1 for bias), y is m×1.
 * Returns coefficients vector of length n.
 *
 * Inline matrix code — no external math lib.
 */
function leastSquaresFit(X, y) {
  const m = X.length;
  const n = X[0].length;

  // Compute X^T X (n×n)
  const XtX = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < m; k++) s += X[k][i] * X[k][j];
      XtX[i][j] = s;
    }
  }

  // Compute X^T y (n×1)
  const Xty = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < m; k++) s += X[k][i] * y[k];
    Xty[i] = s;
  }

  // Augmented matrix for Gauss-Jordan
  const aug = XtX.map((row, i) => [...row, Xty[i]]);

  // Forward elimination + back substitution
  for (let i = 0; i < n; i++) {
    // Pivot — find max in column i
    let maxRow = i;
    let maxVal = Math.abs(aug[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > maxVal) {
        maxVal = Math.abs(aug[k][i]);
        maxRow = k;
      }
    }
    if (maxVal < 1e-12) {
      // Singular — add tiny ridge regularization
      aug[i][i] += 1e-6;
      maxVal = 1e-6;
    }
    if (maxRow !== i) {
      [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    }
    // Normalize pivot row
    const pivot = aug[i][i];
    for (let j = i; j <= n; j++) aug[i][j] /= pivot;
    // Eliminate other rows
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k][i];
      if (Math.abs(factor) < 1e-15) continue;
      for (let j = i; j <= n; j++) aug[k][j] -= factor * aug[i][j];
    }
  }

  return aug.map(row => row[n]);
}

/**
 * Compute RMSE between predicted and target values.
 */
function rmse(predicted, target) {
  if (predicted.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < predicted.length; i++) {
    const d = predicted[i] - target[i];
    s += d * d;
  }
  return Math.sqrt(s / predicted.length);
}

/* ────────────────────────────────────────────────────────────────────
 *  Main flow
 * ──────────────────────────────────────────────────────────────────── */

function main() {
  const args = parseArgs(process.argv);

  console.log("=".repeat(72));
  console.log("AEVION CyberChess — FIDE CPI calibration");
  console.log("=".repeat(72));
  console.log(`Input PGN:  ${args.pgn}`);
  console.log(`Output:     ${args.output}`);
  console.log(`Limit:      ${args.limit === Infinity ? "unlimited" : args.limit}`);
  console.log("");

  const pgnPath = resolve(args.pgn);
  if (!existsSync(pgnPath)) {
    console.error(`ERROR: PGN file not found: ${pgnPath}`);
    process.exit(1);
  }

  console.log("[1/5] Reading PGN file…");
  const raw = readFileSync(pgnPath, "utf8");
  console.log(`      ${raw.length} bytes read.`);

  console.log("[2/5] Splitting games…");
  const chunks = splitGames(raw);
  console.log(`      ${chunks.length} game chunks found.`);

  console.log("[3/5] Parsing + deriving CPI rows…");
  const rows = [];
  let parsed = 0;
  let skipped = 0;
  for (const chunk of chunks) {
    if (rows.length >= args.limit) break;
    try {
      const g = parseGame(chunk);
      if (!g.headers.WhiteElo && !g.headers.BlackElo) {
        skipped++;
        continue;
      }
      if (g.moves.length < 6) {
        skipped++;
        continue;
      }
      const gameRows = deriveRowsFromGame(g);
      for (const r of gameRows) {
        if (rows.length >= args.limit) break;
        // Sanity: Elo bounds
        if (r.targetFide < 800 || r.targetFide > 2900) {
          skipped++;
          continue;
        }
        rows.push(r);
      }
      parsed++;
    } catch (e) {
      skipped++;
    }
  }
  console.log(`      Parsed ${parsed} games. Derived ${rows.length} rows. Skipped ${skipped}.`);

  if (rows.length < 20) {
    console.error("ERROR: Not enough valid rows for fit (need ≥20).");
    process.exit(1);
  }

  console.log("[4/5] Running least-squares fit via normal equations…");
  // Design matrix: [accuracyPct - 60, opening, tactical, endgame, blunder, |time-30|, 1]
  // Last column is bias; first 6 are the same features used by `estimateFideFromCPI`.
  // We center accuracy at baseline 60 (per existing formula) and time at optimal 30.
  const X = rows.map(r => {
    const [acc, open, tac, end, blu, tim] = r.features;
    return [
      acc - 60,                // accuracy delta vs baseline
      Math.min(10, open),      // opening clamped same as frontend
      tac,
      end,
      blu,
      -Math.abs(tim - 30),     // time penalty (always ≤ 0)
      1                        // bias
    ];
  });
  const y = rows.map(r => r.targetFide);

  const coeffs = leastSquaresFit(X, y);
  const [wAcc, wOpen, wTac, wEnd, wBlu, wTime, bias] = coeffs;

  console.log("      Fit complete. Coefficients:");
  console.log(`        accuracy:  ${wAcc.toFixed(3)}   (was 35.000)`);
  console.log(`        opening:   ${wOpen.toFixed(3)}   (was 30.000)`);
  console.log(`        tactical:  ${wTac.toFixed(3)}   (was 250.000)`);
  console.log(`        endgame:   ${wEnd.toFixed(3)}   (was 200.000)`);
  console.log(`        blunder:   ${wBlu.toFixed(3)}   (was -500.000)`);
  console.log(`        time:      ${wTime.toFixed(3)}   (was -2.000)`);
  console.log(`        bias:      ${bias.toFixed(3)}   (was 1200.000 BASE_ELO)`);

  // Compute predictions + RMSE
  const predicted = X.map(row => row.reduce((s, v, i) => s + v * coeffs[i], 0));
  const fitRmse = rmse(predicted, y);
  const meanY = y.reduce((s, v) => s + v, 0) / y.length;
  const ssTot = y.reduce((s, v) => s + (v - meanY) ** 2, 0);
  const ssRes = predicted.reduce((s, v, i) => s + (v - y[i]) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;

  console.log(`      RMSE: ${fitRmse.toFixed(2)} Elo`);
  console.log(`      R²:   ${r2.toFixed(4)}`);

  // Per-bracket residuals for diagnostics
  const brackets = [
    { name: "GM (2500+)", lo: 2500, hi: 3000 },
    { name: "IM (2400-2499)", lo: 2400, hi: 2499 },
    { name: "FM (2300-2399)", lo: 2300, hi: 2399 },
    { name: "CM (2100-2299)", lo: 2100, hi: 2299 },
    { name: "Expert (1800-2099)", lo: 1800, hi: 2099 },
    { name: "Club (1200-1799)", lo: 1200, hi: 1799 },
    { name: "Beginner (<1200)", lo: 0, hi: 1199 },
  ];
  console.log("      Bracket residuals:");
  for (const b of brackets) {
    const indices = y.map((v, i) => (v >= b.lo && v <= b.hi ? i : -1)).filter(i => i >= 0);
    if (indices.length === 0) continue;
    const p = indices.map(i => predicted[i]);
    const t = indices.map(i => y[i]);
    const rmseB = rmse(p, t);
    console.log(`        ${b.name.padEnd(24)} n=${String(indices.length).padStart(5)}  RMSE=${rmseB.toFixed(1)}`);
  }

  console.log("[5/5] Writing output JSON…");

  const out = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceFile: pgnPath,
    samples: rows.length,
    coefficients: {
      accuracy: round(wAcc, 4),
      opening: round(wOpen, 4),
      tactical: round(wTac, 4),
      endgame: round(wEnd, 4),
      blunder: round(wBlu, 4),
      time: round(wTime, 4)
    },
    bias: round(bias, 4),
    fitStats: {
      rmseElo: round(fitRmse, 2),
      r2: round(r2, 4),
      meanTargetElo: round(meanY, 1),
    },
    notes: [
      "Proxy-derived features (no engine eval). Production-grade fit requires per-move Stockfish analysis.",
      "Accuracy / blunder are coarsely derived from game result (win/draw/loss).",
      "Bias replaces BASE_ELO (1200) in estimateFideFromCPI.",
      "Apply weights via ratingCalibrationFit.ts → estimateFideFromCPIWithFit().",
    ]
  };

  const outPath = resolve(args.output);
  const outDir = dirname(outPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`      Wrote ${outPath}`);
  console.log("");
  console.log("Done. To use in frontend:");
  console.log("  import { loadCalibratedWeights, estimateFideFromCPIWithFit }");
  console.log("    from './ratingCalibrationFit';");
  console.log("  const weights = await loadCalibratedWeights();");
  console.log("  const result = estimateFideFromCPIWithFit(metrics, weights);");
}

function round(x, decimals) {
  const m = Math.pow(10, decimals);
  return Math.round(x * m) / m;
}

main();
