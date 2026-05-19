# AEVION CyberChess — FIDE CPI Calibration

Calibration pipeline for the CPI (Chess Performance Indicators) regression
weights used in `frontend/src/app/cyberchess/ratingCalibration.ts`.

The hardcoded weights in `estimateFideFromCPI` (`accuracy*35`, `opening*30`,
`tactical*250`, `endgame*200`, `blunder*-500`, `time*-2`) were eyeballed.
This pipeline fits them via least squares against a real GM corpus and
emits a JSON file the frontend can load at runtime.

## Quick start

```bash
node scripts/cyberchess-fide-calibrate.mjs \
  --pgn ./corpus.pgn \
  --output ./frontend/public/calibration-weights.json \
  --limit 5000
```

Drop the resulting JSON into `frontend/public/` and the next page load
will pick it up via `loadCalibratedWeights()`.

## CLI args

| Flag       | Required | Description                                       |
|------------|----------|---------------------------------------------------|
| `--pgn`    | yes      | Path to PGN dump (any TWIC-style format).         |
| `--output` | yes      | Where to write calibration JSON.                  |
| `--limit`  | no       | Cap on rows (player-game pairs). Default: all.    |

The script needs only Node 18+. No npm install, no dependencies — pure
inline matrix code.

## Where to get a corpus

Order of preference:

1. **Lichess Open Database** (https://database.lichess.org/) — monthly PGN
   dumps. Filter to titled players: `grep -A1 '\[Title "GM"\]' lichess_db_*.pgn`
   then keep the surrounding game chunks. Has WhiteElo / BlackElo on every
   game. Several million GM-level games available.

2. **PGN Mentor master games** (https://www.pgnmentor.com/) — curated TWIC
   archives, smaller but high-quality.

3. **Personal TWIC mirror** — `theweekinchess.com` weekly downloads. ~3000
   master games per week.

4. **ChessBase Mega Database** — only if you already own a copy. Has
   the cleanest Elo metadata but is non-redistributable.

For a rough baseline fit, 5k-10k games is plenty. For tighter brackets,
50k+ helps reduce per-bracket RMSE.

## What the script does

1. Reads PGN, splits into individual games by `[Event "..."]` header.
2. Extracts `WhiteElo` / `BlackElo` / `Result` headers and the move list.
3. For each side per game, derives proxy CPI features:
   - **accuracyPct**: 95 for a win, 85 for a draw, 72 for a loss.
   - **openingTheoryDepth**: consecutive non-capture, non-check plies
     from the start, capped at 14.
   - **tacticalEfficiency**: density of captures+checks / ply count,
     plus +0.2 if a Q/R sacrifice precedes a check.
   - **endgameStrength**: 0.5 baseline, +0.2 if game reached >40 ply
     (weighted down for the losing side).
   - **blunderRate**: 0 (win) / 0.05 (draw) / 0.10 (loss).
   - **avgMoveTime**: 30s default (most GM corpora lack clocks).
4. Builds a design matrix with the same shape as
   `estimateFideFromCPI`'s 6 features + bias term.
5. Solves the normal equations `(XᵀX)β = Xᵀy` via Gauss-Jordan
   elimination with partial pivoting. Adds tiny ridge regularization
   on singular pivots (1e-6).
6. Computes RMSE + R² overall and per Elo bracket (GM / IM / FM / CM /
   Expert / Club / Beginner).
7. Writes the result as JSON.

## Output JSON shape

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-19T12:34:56.000Z",
  "sourceFile": "/abs/path/to/corpus.pgn",
  "samples": 4783,
  "coefficients": {
    "accuracy":  29.4123,
    "opening":   24.8731,
    "tactical": 187.6502,
    "endgame":  156.1289,
    "blunder": -412.0008,
    "time":      -1.7421
  },
  "bias": 1283.5471,
  "fitStats": {
    "rmseElo": 142.7,
    "r2": 0.6431,
    "meanTargetElo": 2387.4
  },
  "notes": [
    "Proxy-derived features (no engine eval). …"
  ]
}
```

## Using in the frontend

`ratingCalibrationFit.ts` exposes two helpers:

```ts
import {
  loadCalibratedWeights,
  estimateFideFromCPIWithFit,
} from "./ratingCalibrationFit";

const weights = await loadCalibratedWeights(); // null if file absent
const result = estimateFideFromCPIWithFit(metrics, weights);
```

Or use the async one-shot wrapper:

```ts
import { estimateFideFromCPIAsync } from "./ratingCalibrationFit";

const result = await estimateFideFromCPIAsync(metrics);
```

If `/calibration-weights.json` is missing, both fall back transparently
to the hardcoded weights from `ratingCalibration.ts` so the app stays
functional without a calibration deploy.

## Caveats

- **Proxy-only.** Without per-move Stockfish eval, accuracy / blunder
  are coarse (win=high accuracy, loss=high blunder). The fit will
  inflate the *correlation* between game result and rating, which is
  partly a tautology. Treat the proxy weights as a seed, not gospel.
- **Production-grade calibration** needs Stockfish to compute true
  centipawn loss per move. Plan to add `scripts/cyberchess-stockfish-eval.mjs`
  that re-derives accuracy / blunder from real engine analysis when we
  have the CPU budget.
- **Selection bias.** A GM-heavy corpus over-represents 2400-2700; the
  fit will be best in that range and weaker at amateur Elo. Bracket
  RMSE in the script output makes this visible.
- **Time feature is mostly dead.** GM PGN dumps rarely have clock
  comments. The weight on `time` will be near-zero or noisy. That's
  expected — once we collect our own players' games with clock data,
  re-run the fit on a mixed corpus.

## Re-running

The frontend loader caches in-memory per page load. To pick up a new
weights file:

1. Re-run the script with a new `--output`.
2. Bust the browser cache (Ctrl+F5).

For dev, call `resetCalibrationCache()` from `ratingCalibrationFit.ts`
between runs.
