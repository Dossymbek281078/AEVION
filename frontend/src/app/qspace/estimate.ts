/**
 * QSpace — спецификация материалов из модели (черновик).
 *
 * Числа выводятся ИЗ ПЛАНА и сгенерированных слоёв, а не набиты руками:
 * поменяется план — поменяется спецификация. Все допущения названы в
 * подписях на странице: площадь пола — по габариту плана, площадь стен —
 * по осям, одна сторона; это черновик для разговора о закупке, не смета
 * под подпись.
 */

import type { Plan, PlumbingDraft, WiringDraft } from "./planModel";
import { planBounds } from "./planModel";

export interface Estimate {
  /** площадь пола по габариту плана, м² */
  floorArea: number;
  /** площадь стен по осям (одна сторона), за вычетом проёмов, м² */
  wallArea: number;
  /** краска на два слоя при расходе 0.12 л/м², л */
  paintLitres: number;
  /** напольное покрытие с запасом 5 % на подрезку, м² */
  flooringArea: number;
  outlets: number;
  switches: number;
  /** кабель: сумма магистралей и спусков, м */
  cableMeters: number;
  /** трубы воды (ХВС + ГВС), м */
  pipeMeters: number;
  /** канализация, м */
  drainMeters: number;
  ceilingLights: number;
}

function runLen(run: Array<[number, number, number]>): number {
  let s = 0;
  for (let i = 0; i + 1 < run.length; i++) {
    s += Math.hypot(
      run[i + 1][0] - run[i][0],
      run[i + 1][1] - run[i][1],
      run[i + 1][2] - run[i][2],
    );
  }
  return s;
}

export function estimatePlan(
  plan: Plan,
  wiring: WiringDraft,
  plumbing: PlumbingDraft,
  ceilingLights: number,
): Estimate {
  const b = planBounds(plan);
  const floorArea = (b.maxX - b.minX) * (b.maxY - b.minY);

  let wallArea = 0;
  for (const w of plan.walls) {
    wallArea += Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * w.height;
  }
  for (const o of plan.openings) {
    wallArea -= o.width * o.height;
  }
  wallArea = Math.max(0, wallArea);

  const cableMeters = wiring.runs.reduce((s, r) => s + runLen(r), 0);
  const pipeMeters =
    plumbing.cold.reduce((s, r) => s + runLen(r), 0) +
    plumbing.hot.reduce((s, r) => s + runLen(r), 0);
  const drainMeters = plumbing.drain.reduce((s, r) => s + runLen(r), 0);

  return {
    floorArea,
    wallArea,
    paintLitres: wallArea * 0.12 * 2,
    flooringArea: floorArea * 1.05,
    outlets: wiring.points.filter((p) => p.kind === "outlet").length,
    switches: wiring.points.filter((p) => p.kind === "switch").length,
    cableMeters,
    pipeMeters,
    drainMeters,
    ceilingLights,
  };
}
