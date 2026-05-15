# CyberChess scripts

## `import-lichess-puzzles.mjs`

Expands `frontend/public/puzzles.json` (currently ~5818 hand-curated puzzles)
to 10000+ by pulling extra tactics from the public Lichess puzzle database.

### Why

Lichess publishes ~4 million curated puzzles under CC0. This script streams
the CSV line-by-line (so memory stays flat even on the full ~900 MB
uncompressed file), picks a stratified sample (diverse by rating bucket),
filters by educational themes, and **merges** the new puzzles into the
existing `public/puzzles.json` — dedup-ing by Lichess PuzzleId AND by FEN —
so curated content is never lost.

### One-time setup

1. Download the Lichess puzzle database (CSV, zstd, ~300 MB):

   https://database.lichess.org/#puzzles

2. Decompress (requires `zstd`):

   ```sh
   zstd -d lichess_db_puzzle.csv.zst -o lichess_db_puzzle.csv
   ```

   Windows: 7-Zip 22.01+ extracts `.zst`. Or `winget install zstd`.

   Result: `lichess_db_puzzle.csv` (~900 MB).

### Run

From repo root, to get from ~5818 → ~10800 puzzles in the 800-2200 rating
band, focused on tactics motifs students need:

```sh
node frontend/scripts/import-lichess-puzzles.mjs \
     --in ./lichess_db_puzzle.csv \
     --out ./frontend/public/puzzles.json \
     --limit 5000 \
     --min-rating 800 --max-rating 2200
```

### Flags

| Flag                  | Default                                | Purpose                                                              |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| `--in <path>`         | (required)                             | Input uncompressed CSV.                                              |
| `--out <path>`        | `frontend/public/puzzles.json`         | Output JSON.                                                         |
| `--limit <N>`         | `5000`                                 | NEW puzzles to add this run (the existing set is kept).              |
| `--min-rating <N>`    | `800`                                  | Lichess rating floor.                                                |
| `--max-rating <N>`    | `2200`                                 | Lichess rating ceiling (2200 = tournament club player).              |
| `--min-plays <N>`     | `100`                                  | Reject under-played (noisy) puzzles.                                 |
| `--min-popularity <N>`| `80`                                   | Reject low-quality / broken puzzles.                                 |
| `--themes <csv>`      | `mate,fork,pin,skewer,discoveredAttack,sacrifice,attraction,deflection,decoy,attack` | Lichess theme tags; puzzle must match at least one. `any` = no filter. |
| `--replace`           | (off)                                  | Overwrite `puzzles.json` instead of merging.                         |
| `--dry-run`           | (off)                                  | Scan and report; don't write.                                        |

### What the script does

1. Streams the CSV with `node:readline` (constant memory, finishes in
   ~2-3 minutes on a typical laptop).
2. Loads existing `puzzles.json`, indexes its FENs and `L<PuzzleId>` names
   into Sets for O(1) dedup.
3. For each row: checks rating window, plays/popularity, theme filter,
   bucket cap, and dedup; if it passes, applies the opponent's setup move
   so the stored FEN is already "student to move", and pushes to the bucket.
4. Stops scanning as soon as every stratified bucket is full.
5. Appends to existing puzzles (unless `--replace`) and writes a single
   minified JSON.

Expected output for `--limit 5000`: `puzzles.json` grows from ~1.4 MB to
~2.5 MB and loads instantly.

### Legal

Lichess puzzles are CC0 / public-domain. Attribution not required but
appreciated (see https://database.lichess.org/).
