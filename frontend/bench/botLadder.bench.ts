/* AEVION CyberChess — bot ladder check. Not part of the test suite.

   The weak-bot levels advertise an Elo to the player (Beginner 400, Casual 800,
   Club 1200) and their character is set by tuned numbers in HUMAN_PROFILES.
   Anyone who edits those numbers should re-check two things:

     1. the blunder rate each level actually produces in real positions, and
     2. whether the ladder's internal spacing still matches the Elo it shows.

   Run it explicitly — the filename is outside the `*.test.ts` glob on purpose,
   because a few hundred real games takes minutes:

     npx vitest run --config vitest.local-nosetup.ts \
       --include "bench/botLadder.bench.ts"

   Honest about what it proves: this measures the ladder RELATIVE to itself. A
   level scoring 91% against the level below it shows a ~400-point gap between
   those two bots — it does NOT show that Beginner plays like a 400-rated human.
   Calibrating to human Elo needs human games, not self-play.

   Machine note: results take minutes, and much longer if other work is loading
   the machine. Check the CPU before concluding the model got slower. */

import { describe, it } from "vitest";
import { writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Chess, type Move } from "chess.js";
import { mm, ev } from "../src/app/cyberchess/minimax";
import { HUMAN_PROFILES, pickBookMove, pickHumanMove, scoreMoves } from "../src/app/cyberchess/humanBot";
import { getBookContinuations } from "../src/app/cyberchess/localOpeningBook";

// Serve the bundled book off disk so the real book path runs unmodified.
const rows = readFileSync("public/openings.json", "utf8");
(globalThis as any).fetch = async () => ({ json: async () => JSON.parse(rows) });

/* Report goes to the OS temp dir, not the working tree: the repo's 30-minute
   auto-backup job commits whatever untracked files it finds, and a benchmark
   report is not something to commit. The path is printed when the run starts. */
const OUT = join(tmpdir(), "aevion-bot-ladder.txt");
const say = (l: string) => appendFileSync(OUT, l + "\n");

/** ALS depth per level, with the same floor the page applies. */
const DEPTH = [1, 2, 3];
const search = (lvl: number) => (pos: Chess) =>
  mm(pos, Math.max(1, Math.min(DEPTH[lvl], 4) - 1), -Infinity, Infinity, pos.turn() === "w");

async function move(g: Chess, lvl: number): Promise<Move> {
  const profile = HUMAN_PROFILES[lvl];
  if (g.history().length < profile.bookPlies) {
    const book = await getBookContinuations(g.fen());
    const uci = pickBookMove(book.moves.map((m) => ({ uci: m.uci, freq: m.freq })), g.history().length, profile);
    if (uci) {
      const m = g.moves({ verbose: true }).find((x) => x.from === uci.slice(0, 2) && x.to === uci.slice(2, 4));
      if (m) return m;
    }
  }
  return pickHumanMove(scoreMoves(g, search(lvl)), profile)!;
}

const MAX_PLY = 60;
/** Unfinished games are adjudicated: roughly a piece up counts as a win. */
const ADJUDICATE_CP = 300;

async function match(a: number, b: number, games: number) {
  let pts = 0, mates = 0, adjudicated = 0;
  for (let n = 0; n < games; n++) {
    const g = new Chess();
    const aIsWhite = n % 2 === 0; // alternate colours so neither side keeps the first move
    while (!g.isGameOver() && g.history().length < MAX_PLY) {
      g.move(await move(g, (g.turn() === "w") === aIsWhite ? a : b));
    }
    if (g.isCheckmate()) {
      mates++;
      if ((g.turn() === "w") !== aIsWhite) pts += 1;
    } else if (g.isGameOver()) {
      pts += 0.5;
    } else {
      const cp = ev(g) * (aIsWhite ? 1 : -1);
      if (cp >= ADJUDICATE_CP) { pts += 1; adjudicated++; }
      else if (cp <= -ADJUDICATE_CP) { adjudicated++; }
      else pts += 0.5;
    }
  }
  return { pts, mates, adjudicated };
}

/** Elo difference a score rate implies. */
const impliedElo = (s: number) => (s <= 0 ? -Infinity : s >= 1 ? Infinity : -400 * Math.log10(1 / s - 1));

describe("bot ladder", () => {
  it("does the advertised Elo gap show up in actual play?", async () => {
    const NAMES = ["Beginner 400", "Casual 800", "Club 1200"];
    const CLAIMED = [400, 800, 1200];
    const GAMES = 10;
    writeFileSync(OUT, "");
    process.stdout.write(`\n[bot-ladder] writing report to ${OUT}\n`);
    say(`${GAMES} games per pairing, max ${MAX_PLY} plies, adjudicated at ${ADJUDICATE_CP}cp.`);
    say(`Internal spacing only — not calibration to human Elo.\n`);
    for (const [a, b] of [[1, 0], [2, 1], [2, 0]] as [number, number][]) {
      const r = await match(a, b, GAMES);
      const score = r.pts / GAMES;
      const gap = CLAIMED[a] - CLAIMED[b];
      const expected = 1 / (1 + Math.pow(10, -gap / 400));
      say(`${NAMES[a]} vs ${NAMES[b]}`);
      say(`  score ${r.pts}/${GAMES} = ${(score * 100).toFixed(0)}%  (mates ${r.mates}, adjudicated ${r.adjudicated})`);
      say(`  advertised gap ${gap} Elo -> expected ${(expected * 100).toFixed(0)}%`);
      say(`  gap implied by play: ${impliedElo(score).toFixed(0)} Elo\n`);
    }
  }, 3_000_000);
});
