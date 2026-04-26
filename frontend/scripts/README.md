# CyberChess scripts

## `import-lichess-puzzles.mjs`

Expands the puzzle database from a handful of hand-written entries to **tens of thousands of real tactics puzzles** pulled from the public Lichess puzzle database.

### Why

The bundled `public/puzzles.json` is small enough to ship with the app. Lichess publishes ~4 million curated puzzles under a permissive license. This script lets you pick a stratified sample (diverse by rating & theme) and replace `public/puzzles.json` in one command.

### One-time setup

1. Download the Lichess puzzle database (CSV, zstd compressed, ~300 MB):

   https://database.lichess.org/#puzzles

2. Decompress (requires `zstd`):

   ```sh
   zstd -d lichess_db_puzzle.csv.zst -o lichess_db_puzzle.csv
   ```

   On Windows with 7-Zip: right-click → 7-Zip → Extract.

### Run

From repo root:

```sh
node frontend/scripts/import-lichess-puzzles.mjs \
     --in ./lichess_db_puzzle.csv \
     --out ./frontend/public/puzzles.json \
     --limit 20000 \
     --min-rating 600 --max-rating 2600 \
     --min-plays 100 --min-popularity 80
```

The script:

- Keeps a **stratified** sample across rating buckets (<900 / 900–1200 / … / 2400+)
  so the puzzles are diverse rather than all mid-rating.
- Discards puzzles with low popularity / few plays (noisy or broken).
- Applies the opponent's setup move to each FEN so the position you load
  is already "student to move".
- Writes a single minified JSON.

Expected output for `--limit 20000`: ~5 MB `puzzles.json`, loads instantly.

### Legal

Lichess puzzles are CC0 / public-domain. Attribution not required but appreciated
(see https://database.lichess.org/ for details).
