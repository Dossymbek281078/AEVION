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
  const args = { pgn: null, output: null, limit: Infinity, featuresCsv: null, weighted: false, noStd: false, nonlinear: false, floorFit: false, ceilingFit: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pgn") args.pgn = argv[++i];
    else if (a === "--output") args.output = argv[++i];
    else if (a === "--features-csv") args.featuresCsv = argv[++i];
    else if (a === "--weighted") args.weighted = true;
    else if (a === "--no-std") args.noStd = true;
    else if (a === "--nonlinear") args.nonlinear = true;
    else if (a === "--floor-fit") args.floorFit = true;
    else if (a === "--ceiling-fit") args.ceilingFit = true;
    else if (a === "--limit") args.limit = Number(argv[++i]) || Infinity;
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/cyberchess-fide-calibrate.mjs --output <path> ( --pgn <path> | --features-csv <path> ) [--limit N]\n" +
        "  --features-csv  Skip PGN parsing and read engine-derived rows from CSV\n" +
        "                  (produced by cyberchess-stockfish-eval.mjs).\n" +
        "                  Columns: gameId,side,targetElo,result,accuracyPct,\n" +
        "                           openingDepth,tacticalEff,endgameStrength,\n" +
        "                           blunderRate,avgMoveTime[,plies,meanCpLoss]"
      );
      process.exit(0);
    }
  }
  if (!args.output || (!args.pgn && !args.featuresCsv)) {
    console.error("ERROR: --output and one of --pgn / --features-csv are required. See --help.");
    process.exit(1);
  }
  return args;
}

function loadRowsFromCsv(path) {
  const raw = readFileSync(path, "utf8").trim();
  const lines = raw.split(/\r?\n/);
  const header = lines.shift().split(",");
  const idx = (name) => header.indexOf(name);
  const required = ["targetElo","accuracyPct","openingDepth","tacticalEff","endgameStrength","blunderRate","avgMoveTime"];
  for (const r of required) {
    if (idx(r) < 0) {
      console.error(`ERROR: features CSV missing column "${r}". Need: ${required.join(", ")}`);
      process.exit(1);
    }
  }
  // Optional new columns from richer feature extraction. If both present,
  // calibrate uses an 8-feature design matrix; if absent, falls back to 6.
  const idxMedian = idx("medianCpLoss");
  const idxStd = idx("cpLossStd");
  const hasRich = idxMedian >= 0 && idxStd >= 0;
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    const targetFide = parseFloat(cols[idx("targetElo")]);
    if (!Number.isFinite(targetFide) || targetFide < 800 || targetFide > 2900) continue;
    const feats = [
      parseFloat(cols[idx("accuracyPct")]),
      parseFloat(cols[idx("openingDepth")]),
      parseFloat(cols[idx("tacticalEff")]),
      parseFloat(cols[idx("endgameStrength")]),
      parseFloat(cols[idx("blunderRate")]),
      parseFloat(cols[idx("avgMoveTime")]),
    ];
    if (hasRich) {
      feats.push(parseFloat(cols[idxMedian]));
      feats.push(parseFloat(cols[idxStd]));
    }
    rows.push({
      targetFide,
      features: feats,
      meta: { side: cols[idx("side")] || "?", rich: hasRich }
    });
  }
  return rows;
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
  console.log(`Input:      ${args.featuresCsv ? "CSV " + args.featuresCsv : "PGN " + args.pgn}`);
  console.log(`Output:     ${args.output}`);
  console.log(`Limit:      ${args.limit === Infinity ? "unlimited" : args.limit}`);
  console.log("");

  let rows;
  let sourceFile;

  if (args.featuresCsv) {
    const csvPath = resolve(args.featuresCsv);
    if (!existsSync(csvPath)) {
      console.error(`ERROR: features CSV not found: ${csvPath}`);
      process.exit(1);
    }
    console.log("[1/4] Loading engine-derived features from CSV…");
    rows = loadRowsFromCsv(csvPath);
    if (rows.length > args.limit) rows = rows.slice(0, args.limit);
    sourceFile = csvPath;
    console.log(`      Loaded ${rows.length} rows.`);
  } else {
    const pgnPath = resolve(args.pgn);
    if (!existsSync(pgnPath)) {
      console.error(`ERROR: PGN file not found: ${pgnPath}`);
      process.exit(1);
    }
    sourceFile = pgnPath;

    console.log("[1/5] Reading PGN file…");
    const raw = readFileSync(pgnPath, "utf8");
    console.log(`      ${raw.length} bytes read.`);

    console.log("[2/5] Splitting games…");
    const chunks = splitGames(raw);
    console.log(`      ${chunks.length} game chunks found.`);

    console.log("[3/5] Parsing + deriving CPI rows…");
    rows = [];
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
  }

  if (rows.length < 20) {
    console.error("ERROR: Not enough valid rows for fit (need ≥20).");
    process.exit(1);
  }

  console.log("[4/5] Running least-squares fit via normal equations…");
  // Design matrix.
  //   Base columns (always present):
  //     [accuracyPct - 60, opening, endgame, blunder, |time-30|, 1]
  //   Rich columns (when CSV has medianCpLoss + cpLossStd):
  //     append [-medianCpLoss, -cpLossStd]
  // Median is robust to outliers — distinguishes a player whose accuracy
  // is dragged down by one big blunder from one whose moves are uniformly
  // weak. Std splits "consistent" from "spiky" players at the same mean.
  // Both come in with the sign already flipped so positive coefficients
  // mean "higher Elo" — matches the convention of the existing columns.
  // Tactical dropped — coefficient was noise across the last 3 fits.
  const hasRichCols = rows.length > 0 && rows[0].features.length >= 8;
  const useStd = hasRichCols && !args.noStd;
  const richMode = hasRichCols;  // median always added when CSV has rich cols
  const nonlin = args.nonlinear;
  // Nonlinear features added to break the linear-OLS ceiling. Captures
  //   "99% accuracy + 0% blunder = GM"     (acc² high, acc·blu near zero)
  //   "80% + 0% blunder = club lucky day"  (acc² mid, acc·blu near zero)
  // The interaction term separates them.
  const X = rows.map(r => {
    const [acc, open, , end, blu, tim, median, std] = r.features;
    const accDelta = acc - 60;
    const base = [
      accDelta,                // accuracy delta vs baseline
      Math.min(10, open),      // opening clamped same as frontend
      end,
      blu,
      -Math.abs(tim - 30),     // time penalty (always ≤ 0)
      1                        // bias
    ];
    let row = base;
    if (richMode) row = useStd ? [...row, -median, -std] : [...row, -median];
    if (nonlin) row = [...row, accDelta * accDelta, blu * blu, accDelta * blu];
    return row;
  });
  const y = rows.map(r => r.targetFide);
  if (richMode || nonlin) {
    const parts = [];
    parts.push(richMode ? (useStd ? "median+std" : "median") : null);
    parts.push(nonlin ? "acc² + blu² + acc·blu" : null);
    console.log(`      Extended design matrix: ${X[0].length} features (extras: ${parts.filter(Boolean).join(", ")})`);
  }

  // Optional weighted least-squares — counters bracket-density bias in OLS.
  // Bucket each target Elo into 200-Elo bins, set weight = 1 / count(bucket).
  // Apply by scaling each row of X and each y entry by sqrt(weight) before
  // solving — algebraically equivalent to (X^T W X) β = X^T W y.
  let Xfit = X, yfit = y;
  if (args.weighted) {
    // Weight floor prevents 1/n exploding when a bucket only has a handful
    // of samples. Without it, brackets with n=3 dominate the fit; see the
    // super-final weighted run (c5f48278 commit message) for the failure
    // mode. Floor of 50 means buckets at or below 50 all share the same
    // weight cap so they no longer overpower mid-density brackets.
    const WEIGHT_FLOOR = 50;
    const bracket = (elo) => Math.floor(elo / 200);
    const counts = new Map();
    for (const v of y) counts.set(bracket(v), (counts.get(bracket(v)) || 0) + 1);
    const w = y.map(v => 1 / Math.max(WEIGHT_FLOOR, counts.get(bracket(v))));
    const meanW = w.reduce((s,x)=>s+x,0) / w.length;
    const sqrtW = w.map(wi => Math.sqrt(wi / meanW));
    Xfit = X.map((row, i) => row.map(v => v * sqrtW[i]));
    yfit = y.map((v, i) => v * sqrtW[i]);
    console.log(`      Weighted LS: 1/max(${WEIGHT_FLOOR}, n_bucket)`);
    [...counts.entries()].sort().forEach(([k, n]) => {
      const effN = Math.max(WEIGHT_FLOOR, n);
      const note = n < WEIGHT_FLOOR ? `  (clipped to ${WEIGHT_FLOOR})` : "";
      console.log(`        bracket ${k*200}-${k*200+199}: n=${String(n).padStart(4)}  weight=${(1/effN).toFixed(5)}${note}`);
    });
  }

  const coeffs = leastSquaresFit(Xfit, yfit);
  // Layout: 6 base + optional [median, std] + optional [acc², blu², acc·blu]
  const wAcc = coeffs[0];
  const wOpen = coeffs[1];
  const wEnd = coeffs[2];
  const wBlu = coeffs[3];
  const wTime = coeffs[4];
  const bias = coeffs[5];
  let next = 6;
  let wMedian = 0, wStd = 0, wAcc2 = 0, wBlu2 = 0, wAccBlu = 0;
  if (richMode) {
    wMedian = coeffs[next++];
    if (useStd) wStd = coeffs[next++];
  }
  if (nonlin) {
    wAcc2 = coeffs[next++];
    wBlu2 = coeffs[next++];
    wAccBlu = coeffs[next++];
  }
  const wTac = 0;  // dropped from design matrix, kept zero in output JSON

  console.log("      Fit complete. Coefficients:");
  console.log(`        accuracy:  ${wAcc.toFixed(3)}   (was 35.000)`);
  console.log(`        opening:   ${wOpen.toFixed(3)}   (was 30.000)`);
  console.log(`        tactical:  0.000           (dropped — was noise)`);
  console.log(`        endgame:   ${wEnd.toFixed(3)}   (was 200.000)`);
  console.log(`        blunder:   ${wBlu.toFixed(3)}   (was -500.000)`);
  console.log(`        time:      ${wTime.toFixed(3)}   (was -2.000)`);
  console.log(`        bias:      ${bias.toFixed(3)}   (was 1200.000 BASE_ELO)`);
  if (richMode) {
    console.log(`        median:    ${wMedian.toFixed(3)}   (rich, applied to -medianCpLoss)`);
    if (useStd) console.log(`        std:       ${wStd.toFixed(3)}   (rich, applied to -cpLossStd)`);
  }
  if (nonlin) {
    console.log(`        accuracy²: ${wAcc2.toFixed(4)}  (nonlin, applied to (acc-60)²)`);
    console.log(`        blunder²:  ${wBlu2.toFixed(3)}  (nonlin, applied to blunder²)`);
    console.log(`        acc·blu:   ${wAccBlu.toFixed(3)}  (nonlin, interaction term)`);
  }

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

  // Optional second-pass bracket fits. floor-fit restricts to high-Elo
  // rows (≥2400) to fix the GM-bracket pull-toward-mean; ceiling-fit
  // mirrors it on the low end (<1500) where nonlinear over-corrections
  // pushed Beginner predictions into the 400-Elo clamp.
  function runBracketFit(label, indicesPredicate, thresholdValue, stepName) {
    const idxs = y.map((v, i) => indicesPredicate(v) ? i : -1).filter(i => i >= 0);
    if (idxs.length < 30) {
      console.log(`[${stepName}] --${label}: only ${idxs.length} matching rows — skipping (need ≥30)`);
      return null;
    }
    console.log(`[${stepName}] ${label} pass on ${idxs.length} rows…`);
    const Xb = idxs.map(i => X[i]);
    const yb = idxs.map(i => y[i]);
    let XbFit = Xb, ybFit = yb;
    if (args.weighted) {
      const WEIGHT_FLOOR = 50;
      const bracket = (elo) => Math.floor(elo / 200);
      const cnts = new Map();
      for (const v of yb) cnts.set(bracket(v), (cnts.get(bracket(v)) || 0) + 1);
      const wRaw = yb.map(v => 1 / Math.max(WEIGHT_FLOOR, cnts.get(bracket(v))));
      const meanW = wRaw.reduce((s,x)=>s+x,0) / wRaw.length;
      const sqrtW = wRaw.map(wi => Math.sqrt(wi / meanW));
      XbFit = Xb.map((row, i) => row.map(v => v * sqrtW[i]));
      ybFit = yb.map((v, i) => v * sqrtW[i]);
    }
    const cb = leastSquaresFit(XbFit, ybFit);
    const predB = Xb.map(row => row.reduce((s, v, i) => s + v * cb[i], 0));
    const rmseB = rmse(predB, yb);
    const meanB = yb.reduce((s, v) => s + v, 0) / yb.length;
    const ssTotB = yb.reduce((s, v) => s + (v - meanB) ** 2, 0);
    const ssResB = predB.reduce((s, v, i) => s + (v - yb[i]) ** 2, 0);
    const r2B = 1 - ssResB / ssTotB;
    console.log(`      ${label}: RMSE=${rmseB.toFixed(1)}  R²=${r2B.toFixed(4)}  bias=${cb[5].toFixed(2)}`);
    let n = 6;
    const coefs = {
      accuracy: round(cb[0], 4),
      opening: round(cb[1], 4),
      tactical: 0,
      endgame: round(cb[2], 4),
      blunder: round(cb[3], 4),
      time: round(cb[4], 4),
    };
    if (richMode) {
      coefs.median = round(cb[n++], 4);
      if (useStd) coefs.std = round(cb[n++], 4);
    }
    if (nonlin) {
      coefs.accuracy2 = round(cb[n++], 6);
      coefs.blunder2 = round(cb[n++], 4);
      coefs.accBlu = round(cb[n++], 4);
    }
    return {
      threshold: thresholdValue,
      samples: idxs.length,
      coefficients: coefs,
      bias: round(cb[5], 4),
      fitStats: { rmseElo: round(rmseB, 2), r2: round(r2B, 4) },
    };
  }

  const FLOOR_THRESHOLD = 2400;
  const CEILING_THRESHOLD = 1500;
  const floorFitBlock = args.floorFit
    ? runBracketFit("floor-fit", v => v >= FLOOR_THRESHOLD, FLOOR_THRESHOLD, "4b/5")
    : null;
  const ceilingFitBlock = args.ceilingFit
    ? runBracketFit("ceiling-fit", v => v < CEILING_THRESHOLD, CEILING_THRESHOLD, "4c/5")
    : null;

  console.log("[5/5] Writing output JSON…");

  const out = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceFile,
    samples: rows.length,
    coefficients: {
      accuracy: round(wAcc, 4),
      opening: round(wOpen, 4),
      tactical: round(wTac, 4),
      endgame: round(wEnd, 4),
      blunder: round(wBlu, 4),
      time: round(wTime, 4),
      ...(richMode ? { median: round(wMedian, 4) } : {}),
      ...(richMode && useStd ? { std: round(wStd, 4) } : {}),
      ...(nonlin ? { accuracy2: round(wAcc2, 6), blunder2: round(wBlu2, 4), accBlu: round(wAccBlu, 4) } : {})
    },
    bias: round(bias, 4),
    fitStats: {
      rmseElo: round(fitRmse, 2),
      r2: round(r2, 4),
      meanTargetElo: round(meanY, 1),
    },
    ...(floorFitBlock ? { floorFit: floorFitBlock } : {}),
    ...(ceilingFitBlock ? { ceilingFit: ceilingFitBlock } : {}),
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
