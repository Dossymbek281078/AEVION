/**
 * QSpace — тёплый пол: сколько трубы купить и хватит ли мощности.
 *
 * Считается из площадей помещений, которые уже выделены (rooms.ts). Вопрос,
 * на который отвечает: «сколько метров трубы и какой шаг» — с ним идут в
 * магазин и к монтажнику.
 *
 * Что учтено и почему:
 *  - под встроенной мебелью и сантехникой трубу НЕ кладут: перегреется и
 *    пропадёт зря. Поэтому из площади вычитается след такой мебели;
 *  - отступ от стен 10 см — там труба всё равно не греет комнату;
 *  - шаг укладки задаёт человек: 15 см — обычная жилая комната, 10 см —
 *    санузел и зоны у окна, где нужно теплее;
 *  - длина контура ограничена: на трубе 16 мм больше 100 м гнать нельзя,
 *    насос не продавит. Если не влезает — комнату делят на контуры, и это
 *    говорится прямо, а не молча выдаётся одна огромная цифра.
 *
 * 🔴 ГРАНИЦА: это прикидка для закупки, а не гидравлический расчёт. Реальную
 * раскладку и балансировку делает монтажник; мощность зависит от утепления
 * дома, которого мы не знаем. Так и написано на странице.
 */

import type { Room } from "./rooms";

/** Максимальная длина одного контура для трубы 16 мм, м. */
const MAX_LOOP_M = 100;
/** Отступ от стен, где трубу не кладут, м. */
const WALL_MARGIN = 0.1;
/** Удельная мощность тёплого пола в жилом помещении, Вт/м². */
const WATT_PER_M2 = 100;

export interface HeatingRoom {
  index: number;
  /** площадь, по которой реально кладут трубу, м² */
  heatedArea: number;
  /** длина трубы, м */
  pipeLength: number;
  /** во сколько контуров придётся разделить */
  loops: number;
  /** тепловая мощность, Вт */
  power: number;
}

export interface HeatingResult {
  rooms: HeatingRoom[];
  totals: { heatedArea: number; pipeLength: number; loops: number; power: number };
  warnings: string[];
}

/**
 * Расчёт тёплого пола.
 *
 * `stepM` — шаг укладки, м (0.1–0.3). `blockedAreaByRoom` — площадь под
 * встроенной мебелью по номеру комнаты: под ванной и кухонным гарнитуром
 * трубу не кладут.
 */
export function heatingPlan(
  rooms: Room[],
  stepM = 0.15,
  blockedAreaByRoom: Record<number, number> = {},
): HeatingResult {
  const warnings: string[] = [];

  if (!(stepM >= 0.1) || !(stepM <= 0.3)) {
    return {
      rooms: [],
      totals: { heatedArea: 0, pipeLength: 0, loops: 0, power: 0 },
      warnings: [`Шаг укладки ${stepM} м вне разумного: бывает от 0.1 до 0.3 м.`],
    };
  }

  const out: HeatingRoom[] = [];
  for (const r of rooms) {
    // отступ от стен: приблизительно периметр × ширину полосы
    const margin = r.perimeter * WALL_MARGIN;
    const blocked = blockedAreaByRoom[r.index] ?? 0;
    const heated = Math.max(0, r.area - margin - blocked);
    if (heated < 1) {
      warnings.push(`Помещение ${r.index}: под трубу остаётся меньше 1 м² — тёплый пол тут не нужен.`);
      continue;
    }
    // длина трубы: площадь, делённая на шаг, плюс 10 % на повороты и подводку
    const pipe = (heated / stepM) * 1.1;
    const loops = Math.ceil(pipe / MAX_LOOP_M);
    if (loops > 1) {
      warnings.push(
        `Помещение ${r.index}: труба ${pipe.toFixed(0)} м не влезает в один контур `
        + `(предел ${MAX_LOOP_M} м) — понадобится ${loops} контура и коллектор.`,
      );
    }
    out.push({
      index: r.index,
      heatedArea: heated,
      pipeLength: pipe,
      loops,
      power: heated * WATT_PER_M2,
    });
  }

  const totals = out.reduce(
    (a, r) => ({
      heatedArea: a.heatedArea + r.heatedArea,
      pipeLength: a.pipeLength + r.pipeLength,
      loops: a.loops + r.loops,
      power: a.power + r.power,
    }),
    { heatedArea: 0, pipeLength: 0, loops: 0, power: 0 },
  );

  return { rooms: out, totals, warnings };
}

/** Подпись шага для человека: почему именно такой. */
export function stepHint(stepM: number): string {
  if (stepM <= 0.11) return "10 см — санузел и зона у окна, где нужно теплее";
  if (stepM <= 0.16) return "15 см — обычная жилая комната";
  return `${Math.round(stepM * 100)} см — экономный шаг, пол будет прохладнее`;
}
