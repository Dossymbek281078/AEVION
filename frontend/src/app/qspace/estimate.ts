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

export type WallAreaSource = "rooms" | "axes";

export interface Estimate {
  /** площадь пола, м² — основание см. в `floorAreaSource` */
  floorArea: number;
  /**
   * Откуда взята площадь пола. Ярлык на экране обязан следовать за
   * основанием: подпись «по габариту плана» пережила саму правку на габарит и
   * сутки врала бы человеку про способ, которым посчитано его покрытие.
   */
  floorAreaSource: WallAreaSource;
  /** площадь стен, м² — основание см. в `wallAreaSource` */
  wallArea: number;
  /**
   * Откуда взята площадь стен. Число несёт свою родословную само: подпись на
   * экране обязана называть основание, иначе человек прочтёт «стены» и не
   * узнает, что это осевые линии, а не то, что он будет красить.
   */
  wallAreaSource: WallAreaSource;
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
  /**
   * Сумма площадей ПОМЕЩЕНИЙ, м². Когда известна — считаем по ней.
   *
   * Прежде площадь пола бралась габаритом плана, и это было написано до того,
   * как модуль научился выделять помещения. Замер на демо-квартире: габарит
   * 48 м² против 41.1 м² по комнатам — покрытия человек купил бы на 17 %
   * больше, а это деньги. Стены не застилают.
   *
   * Габарит остаётся запасным путём: если помещения не выделились (открытый
   * контур, картинка с разрывами), лучше завышенная оценка, чем никакой.
   */
  roomArea?: number,
  /**
   * Площадь стен ПО КОМНАТАМ (сумма периметр × высоту), м².
   *
   * Замер 08.09.2026 на демо-квартире: по осям стен выходило 86.7 м² и 20.8 л
   * краски, по комнатам — 115.3 м² и 27.7 л. Расхождение 33 %, и оба числа
   * стояли на ОДНОМ экране: список по комнатам выше, общая смета ниже.
   *
   * Верна комнатная сторона: красят ВНУТРЕННИЕ поверхности, и перегородка
   * попадает дважды — по разу на каждую соседнюю комнату. Счёт по осям берёт
   * её один раз, а наружную стену меряет по осевой линии, а не по грани.
   * Занижение краски дороже завышения: не хватит посреди работы, а
   * докупленная партия ляжет другим оттенком.
   */
  roomWallArea?: number,
): Estimate {
  const b = planBounds(plan);
  const поКомнатам = Boolean(roomArea && roomArea > 0);
  const floorArea = поКомнатам
    ? (roomArea as number)
    : (b.maxX - b.minX) * (b.maxY - b.minY);
  const floorAreaSource: WallAreaSource = поКомнатам ? "rooms" : "axes";

  // Проёмы вычитаются ТОЛЬКО на запасном пути. Комнатная сторона их намеренно
  // не вычитает (положение проёмов по комнатам неизвестно, а завышение здесь
  // безопаснее), и вычесть их тут значило бы вернуть расхождение с другой
  // стороны: числа опять перестали бы сходиться.
  let wallArea: number;
  let wallAreaSource: WallAreaSource;
  if (roomWallArea && roomWallArea > 0) {
    wallArea = roomWallArea;
    wallAreaSource = "rooms";
  } else {
    let byAxes = 0;
    for (const w of plan.walls) {
      byAxes += Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * w.height;
    }
    for (const o of plan.openings) {
      byAxes -= o.width * o.height;
    }
    wallArea = Math.max(0, byAxes);
    wallAreaSource = "axes";
  }

  const cableMeters = wiring.runs.reduce((s, r) => s + runLen(r), 0);
  const pipeMeters =
    plumbing.cold.reduce((s, r) => s + runLen(r), 0) +
    plumbing.hot.reduce((s, r) => s + runLen(r), 0);
  const drainMeters = plumbing.drain.reduce((s, r) => s + runLen(r), 0);

  return {
    floorArea,
    floorAreaSource,
    wallArea,
    wallAreaSource,
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
