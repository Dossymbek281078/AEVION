/* AEVION CyberChess — качество дебюта у слабых уровней. Не часть тестового набора.
 *
 * Третий замер лестницы, и он нужен ровно потому, что первые два его не видят:
 *   botLadder.bench.ts   — разрыв МЕЖДУ уровнями (часы),
 *   blunderRate.bench.ts — частота зевков КАЖДОГО уровня (минуты),
 *   этот файл            — не превращается ли дебют в мусор.
 *
 * Историческая причина: первая версия слабых ботов имела температуру 260, и Beginner
 * открывал 1.h4 в трети партий — «равномерно посредственный» бот, ради ухода от которого
 * humanBot и писался. Охлаждение температуры это убрало (8% мусорных первых ходов), но
 * подъём температуры 40 -> 95 в 2026-07-27 вернул часть: замер дал 15%.
 *
 * Значит любая правка `temperature`, `bookChance` или `bookPlies` обязана проверяться и
 * здесь тоже — иначе выигрыш в силе оплачивается дебютом, и этого никто не заметит.
 *
 * Запуск:  npx vitest run --config vitest.bench.config.ts bench/openingQuality.bench.ts
 * Уровень: BENCH_LEVELS=0   Партий: BENCH_GAMES=60
 *
 * Замер 2026-07-27, Beginner при temperature 95, 60 партий:
 *   мусорных первых ходов 15% (при temperature 40 было 8%)
 *   частые: e4×17, d4×14, Nf3×5, b4×4, g3×3, f4×3, Nc3×3, a4×2
 */
import { describe, it } from "vitest";
import { writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Chess, type Move } from "chess.js";
import { mm } from "../src/app/cyberchess/minimax";
import { HUMAN_PROFILES, pickBookMove, pickHumanMove, scoreMoves } from "../src/app/cyberchess/humanBot";
import { getBookContinuations } from "../src/app/cyberchess/localOpeningBook";

/* Книга читается с диска: без стаба `getBookContinuations` ушла бы в сеть и молча вернула
   пустой результат — бот играл бы «без книги», и замер показал бы не то, что в игре. */
const rows = readFileSync("public/openings.json", "utf8");
(globalThis as { fetch?: unknown }).fetch = async () => ({ json: async () => JSON.parse(rows) });

const OUT = join(tmpdir(), "aevion-opening-quality.txt");
const say = (l: string) => appendFileSync(OUT, l + "\n");

const DEPTH = [1, 2, 3];
const search = (lvl: number) => (pos: Chess) =>
  mm(pos, Math.max(1, Math.min(DEPTH[lvl], 4) - 1), -Infinity, Infinity, pos.turn() === "w");

/** Первые ходы, по которым прошлая настройка судила о «мусорном» дебюте. */
const JUNK = new Set(["a4", "h4", "g4", "Na3", "Nh3", "f3", "b4", "a3", "h3"]);

async function firstMove(lvl: number): Promise<Move> {
  const g = new Chess();
  const profile = HUMAN_PROFILES[lvl];
  const book = await getBookContinuations(g.fen());
  const uci = pickBookMove(book.moves.map((m) => ({ uci: m.uci, freq: m.freq })), 0, profile);
  if (uci) {
    const m = g.moves({ verbose: true }).find((x) => x.from === uci.slice(0, 2) && x.to === uci.slice(2, 4));
    if (m) return m;
  }
  return pickHumanMove(scoreMoves(g, search(lvl)), profile)!;
}

describe("opening quality", () => {
  it("counts junk first moves", async () => {
    writeFileSync(OUT, "");
    process.stdout.write(`\n[opening-quality] writing report to ${OUT}\n`);
    const lvl = Number(process.env.BENCH_LEVELS || 0);
    const games = Number(process.env.BENCH_GAMES || 60);
    let junk = 0;
    const seen: Record<string, number> = {};
    for (let n = 0; n < games; n++) {
      const m = await firstMove(lvl);
      seen[m.san] = (seen[m.san] || 0) + 1;
      if (JUNK.has(m.san)) junk++;
    }
    const top = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 8);
    say(`уровень ${lvl} (temperature ${HUMAN_PROFILES[lvl].temperature}, bookChance ${HUMAN_PROFILES[lvl].bookChance}), ${games} партий`);
    say(`мусорных первых ходов: ${((junk / games) * 100).toFixed(0)}%  (${junk} из ${games})`);
    say(`частые первые ходы: ${top.map(([s, c]) => `${s}×${c}`).join(", ")}`);
  }, 600_000);
});
