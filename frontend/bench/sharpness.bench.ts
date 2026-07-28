/* AEVION CyberChess — острота позиции и распределение зевков по ней. Не часть тестового набора.
 *
 * Зачем. Модель ошибок бота плоская: `blunderChance` одинаков в любой позиции.
 * У людей не так — в позиции, где на доске куча взятий и шахов, слабый игрок
 * ошибается заметно чаще, чем в тихой, где ошибиться просто негде. Плоская модель
 * читается как механическая: бот зевает фигуру в мёртвой позиции ровно так же
 * охотно, как в свалке.
 *
 * Этот замер отвечает на два вопроса ДО правки, чтобы потом было с чем сравнить:
 *   1. Как вообще распределена острота в реальной самоигре — какие значения считать
 *      «тихо» и «остро». Без этого константа модуляции была бы выдумана.
 *   2. Отличается ли сейчас доля зевков в тихих и острых позициях. Ожидание: НЕТ,
 *      потому что модель плоская. Если отличие вдруг есть — значит острота уже
 *      как-то коррелирует с числом ходов, и это надо учесть.
 *
 * Острота считается БЕЗ движка, по самим ходам: доля взятий и шахов среди легальных.
 * Дорогих вычислений здесь нет, поэтому ту же формулу можно применять в игре.
 *
 * Запуск:  npx vitest run --config vitest.bench.config.ts bench/sharpness.bench.ts
 * Уровни:  BENCH_LEVELS=0        Позиций: BENCH_POSITIONS=300
 *
 * ЗАМЕРЕНО 2026-07-28 — и ожидание не подтвердилось:
 *   Beginner 400 (300 позиций): острота медиана 0.056, среднее 0.077, квартили 0.000/0.103
 *     зевков в тихих 18.4%, в острых 25.2% — разница 6.8 пункта
 *   Casual 800 (200 позиций):   острота медиана 0.061, среднее 0.072
 *     зевков в тихих 8.8%, в острых 11.0% — разница 2.2 пункта
 *   Club 1200: не досчитался за отведённое время (поиск глубже) — данных нет.
 *
 * Вывод: зависимость от остроты УЖЕ ЕСТЬ, хотя `blunderChance` плоский. Причина
 * структурная, а не заложенная: ветка зевка срабатывает только когда проигрывающий
 * ход реально доступен (`top.score - s.score >= BLUNDER_CP`), а в тихой позиции его
 * часто просто нет на доске. То есть модель ошибок получает человеческое поведение
 * не из коэффициента, а из самой позиции.
 *
 * Поэтому задуманная модуляция `blunderChance` по остроте НЕ внедрена: усиливать
 * эффект пришлось бы к выдуманной цели — эталона «насколько чаще человек ошибается
 * в острой позиции» под рукой нет, а число из головы здесь хуже, чем его отсутствие.
 * Замер остаётся как страховка: если кто-то сгладит ветку зевка, разница схлопнется
 * и это будет видно.
 */
import { describe, it } from "vitest";
import { writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Chess, type Move } from "chess.js";
import { mm } from "../src/app/cyberchess/minimax";
import { HUMAN_PROFILES, pickHumanMove, scoreMoves, sharpnessOf, type ScoredMove } from "../src/app/cyberchess/humanBot";

const OUT = join(tmpdir(), "aevion-sharpness.txt");
const say = (l: string) => appendFileSync(OUT, l + "\n");

const DEPTH = [1, 2, 3];
const search = (lvl: number) => (pos: Chess) =>
  mm(pos, Math.max(1, Math.min(DEPTH[lvl], 4) - 1), -Infinity, Infinity, pos.turn() === "w");

const BLUNDER_CP = 200;
const SAMPLES = 200;

/** Позиции из настоящей самоигры этого же уровня — не из выдуманного набора. */
function walk(lvl: number, count: number): ScoredMove[][] {
  const out: ScoredMove[][] = [];
  const g = new Chess();
  while (out.length < count) {
    if (g.isGameOver() || g.history().length > 70) { g.reset(); continue }
    const scored = scoreMoves(g, search(lvl));
    if (scored.length > 1) out.push(scored);
    const next = pickHumanMove(scored, HUMAN_PROFILES[lvl]);
    if (!next) { g.reset(); continue }
    g.move(next as Move);
  }
  return out;
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

describe("sharpness", () => {
  it("measures how sharpness is distributed and how blunders sit on it", () => {
    writeFileSync(OUT, "");
    process.stdout.write(`\n[sharpness] writing report to ${OUT}\n`);
    const levels = (process.env.BENCH_LEVELS || "0,1,2").split(",").map(Number);
    const positions = Number(process.env.BENCH_POSITIONS || 300);
    const NAMES = ["Beginner 400", "Casual 800", "Club 1200"];
    say(`${positions} позиций из самоигры на уровень, ${SAMPLES} выборок на позицию.`);
    say(`Острота = доля взятий и шахов среди легальных ходов, без движка.\n`);

    for (const lvl of levels) {
      const cache = walk(lvl, positions);
      const sharp = cache.map((s) => sharpnessOf(s));
      const sorted = [...sharp].sort((a, b) => a - b);
      const median = quantile(sorted, 0.5);
      const mean = sharp.reduce((a, b) => a + b, 0) / sharp.length;

      // Делим ровно по медиане своей же выборки: «тихо» и «остро» — не выдуманные
      // пороги, а две половины реального распределения этого уровня.
      let quietBl = 0, quietTot = 0, sharpBl = 0, sharpTot = 0;
      for (let i = 0; i < cache.length; i++) {
        const scored = cache[i];
        const best = Math.max(...scored.map((s) => s.score));
        const isSharp = sharp[i] > median;
        for (let k = 0; k < SAMPLES; k++) {
          const m = pickHumanMove(scored, HUMAN_PROFILES[lvl]);
          if (!m) continue;
          const picked = scored.find((s) => s.move === m);
          if (!picked) continue;
          const blundered = best - picked.score >= BLUNDER_CP;
          if (isSharp) { sharpTot++; if (blundered) sharpBl++ }
          else { quietTot++; if (blundered) quietBl++ }
        }
      }
      const q = quietTot ? (quietBl / quietTot) * 100 : 0;
      const s = sharpTot ? (sharpBl / sharpTot) * 100 : 0;
      say(`${NAMES[lvl]} (blunderChance ${HUMAN_PROFILES[lvl].blunderChance})`);
      say(`  острота: медиана ${median.toFixed(3)}, среднее ${mean.toFixed(3)}, ` +
          `квартили ${quantile(sorted, 0.25).toFixed(3)} / ${quantile(sorted, 0.75).toFixed(3)}, ` +
          `макс ${sorted[sorted.length - 1].toFixed(3)}`);
      say(`  зевков в ТИХИХ  позициях: ${q.toFixed(1)}%  (${quietBl} из ${quietTot})`);
      say(`  зевков в ОСТРЫХ позициях: ${s.toFixed(1)}%  (${sharpBl} из ${sharpTot})`);
      say(`  разница: ${(s - q).toFixed(1)} пункта\n`);
    }
  }, 3_000_000);
});
