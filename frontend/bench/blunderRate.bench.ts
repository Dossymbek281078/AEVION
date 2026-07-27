/* AEVION CyberChess — частота зевков по уровням. Не часть тестового набора.
 *
 * Характер слабого уровня задаётся двумя числами: `blunderChance` (как часто бот нарочно
 * ошибается) и `temperature` (насколько «дёшевы» для него остальные ходы). Полоса рейтинга
 * подразумевает долю ходов, теряющих >=200cp: ~22% / ~11% / ~4.5% для Beginner / Casual /
 * Club. Ladder-bench меряет РАЗРЫВ между уровнями, а это — характер каждого по отдельности,
 * и после правки температуры проверять нужно оба: разрыв мог сойтись за счёт того, что бот
 * стал зевать чаще, чем обещает его полоса.
 *
 * Запуск:  npx vitest run --config vitest.bench.config.ts bench/blunderRate.bench.ts
 * Уровни:  BENCH_LEVELS=0        (по умолчанию все три)
 *
 * Приём тот же, что и в прошлый раз: позиции скорятся ОДИН раз и кешируются, потом по кешу
 * гоняется много выборок. Полные партии на каждую выборку дважды упирались в таймаут.
 */
import { describe, it } from "vitest";
import { writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Chess, type Move } from "chess.js";
import { mm } from "../src/app/cyberchess/minimax";
import { HUMAN_PROFILES, pickHumanMove, scoreMoves, type ScoredMove } from "../src/app/cyberchess/humanBot";

const OUT = join(tmpdir(), "aevion-blunder-rate.txt");
const say = (l: string) => appendFileSync(OUT, l + "\n");

const DEPTH = [1, 2, 3];
const search = (lvl: number) => (pos: Chess) =>
  mm(pos, Math.max(1, Math.min(DEPTH[lvl], 4) - 1), -Infinity, Infinity, pos.turn() === "w");

/** Ход считается зевком, если он отстаёт от лучшего на 200cp и более. */
const BLUNDER_CP = 200;
const POSITIONS = 40;
const SAMPLES = 300;

/** Позиции берутся из настоящей самоигры этого же уровня — не из выдуманного набора. */
function walk(lvl: number, count: number): ScoredMove[][] {
  const out: ScoredMove[][] = [];
  const g = new Chess();
  while (out.length < count) {
    if (g.isGameOver() || g.history().length > 70) {
      g.reset();
      continue;
    }
    const scored = scoreMoves(g, search(lvl));
    if (scored.length > 1) out.push(scored);
    const next = pickHumanMove(scored, HUMAN_PROFILES[lvl]);
    if (!next) {
      g.reset();
      continue;
    }
    g.move(next as Move);
  }
  return out;
}

describe("blunder rate per level", () => {
  it("measures how often each level drops 200cp", () => {
    writeFileSync(OUT, "");
    process.stdout.write(`\n[blunder-rate] writing report to ${OUT}\n`);
    const levels = (process.env.BENCH_LEVELS || "0,1,2").split(",").map(Number);
    const NAMES = ["Beginner 400", "Casual 800", "Club 1200"];
    const TARGET = [22, 11, 4.5];
    say(`${POSITIONS} позиций из самоигры, ${SAMPLES} выборок на позицию, порог ${BLUNDER_CP}cp.`);
    say(`Цель по полосе рейтинга: ${TARGET.map((t, i) => `${NAMES[i]} ~${t}%`).join(", ")}\n`);
    for (const lvl of levels) {
      const cache = walk(lvl, POSITIONS);
      let blunders = 0;
      let total = 0;
      let lossSum = 0;
      for (const scored of cache) {
        const best = Math.max(...scored.map((s) => s.score));
        for (let i = 0; i < SAMPLES; i++) {
          const m = pickHumanMove(scored, HUMAN_PROFILES[lvl]);
          if (!m) continue;
          const picked = scored.find((s) => s.move === m);
          if (!picked) continue;
          const loss = best - picked.score;
          total++;
          if (loss >= BLUNDER_CP) blunders++;
          else lossSum += loss;
        }
      }
      const pct = total ? (blunders / total) * 100 : 0;
      const avgLoss = total - blunders > 0 ? lossSum / (total - blunders) : 0;
      say(`${NAMES[lvl]} (temperature ${HUMAN_PROFILES[lvl].temperature}, blunderChance ${HUMAN_PROFILES[lvl].blunderChance})`);
      say(`  зевков ${pct.toFixed(1)}% при цели ~${TARGET[lvl]}%  (${blunders} из ${total})`);
      say(`  средняя потеря на НЕзевках: ${avgLoss.toFixed(0)}cp\n`);
    }
  }, 3_000_000);
});
