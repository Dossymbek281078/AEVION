/**
 * QSpace — спецификация ПО КОМНАТАМ.
 *
 * Общая площадь для закупки бесполезна: плитку берут в санузел, паркет в
 * комнату, обои считают по периметру каждой. Здесь площади помещений
 * превращаются в строки, по которым можно идти в магазин.
 *
 * Что считается и с какими допущениями (они названы человеку на странице):
 *  - покрытие пола = площадь комнаты + 5 % на подрезку;
 *  - стены под обои/краску = периметр × высоту, БЕЗ вычета проёмов: их
 *    положение по комнатам мы не знаем, а завышение здесь безопаснее
 *    занижения — не хватит рулона хуже, чем останется лишний;
 *  - плинтус = периметр минус ширина дверей комнаты, если она известна,
 *    иначе весь периметр.
 */

import type { Room } from "./rooms";

export interface RoomSpecLine {
  index: number;
  area: number;
  perimeter: number;
  /** напольное покрытие с запасом, м² */
  flooring: number;
  /** площадь стен, м² */
  wallArea: number;
  /** краска на два слоя, л */
  paint: number;
  /** плинтус, м */
  skirting: number;
}

export interface RoomSpec {
  lines: RoomSpecLine[];
  totals: {
    area: number;
    flooring: number;
    wallArea: number;
    paint: number;
    skirting: number;
  };
}

/**
 * Расход краски на слой, л/м². Экспортируется НАМЕРЕННО.
 *
 * Ставка стояла в трёх местах: числом в общей смете, константой здесь и
 * словами в подписи на экране. Общая смета и таблица по комнатам обязаны
 * сходиться (08.09 они разошлись на 33 % по другой причине, и это стоило
 * человеку семи литров), а три копии одной ставки — готовая вторая причина
 * разойтись. Источник один, читают его все.
 */
export const PAINT_LITRES_PER_M2 = 0.12;
/** Слоёв краски. */
export const PAINT_COATS = 2;
const PAINT_PER_M2 = PAINT_LITRES_PER_M2 * PAINT_COATS;
/** Запас на подрезку покрытия: 5 %. */
export const CUT_WASTE = 1.05;

export function roomSpec(
  rooms: Room[],
  wallHeight: number,
  /** сколько метров дверных проёмов приходится на комнату (0, если неизвестно) */
  doorWidthPerRoom = 0,
): RoomSpec {
  const lines: RoomSpecLine[] = rooms.map((r) => {
    const wallArea = r.perimeter * wallHeight;
    return {
      index: r.index,
      area: r.area,
      perimeter: r.perimeter,
      flooring: r.area * CUT_WASTE,
      wallArea,
      paint: wallArea * PAINT_PER_M2,
      skirting: Math.max(0, r.perimeter - doorWidthPerRoom),
    };
  });

  const totals = lines.reduce(
    (acc, l) => ({
      area: acc.area + l.area,
      flooring: acc.flooring + l.flooring,
      wallArea: acc.wallArea + l.wallArea,
      paint: acc.paint + l.paint,
      skirting: acc.skirting + l.skirting,
    }),
    { area: 0, flooring: 0, wallArea: 0, paint: 0, skirting: 0 },
  );

  return { lines, totals };
}

/**
 * Спецификация текстом — чтобы скопировать в сообщение подрядчику или
 * распечатать. Это единственный способ отдать расчёт человеку, у которого
 * нет нашего сайта.
 */
export function roomSpecText(spec: RoomSpec, planName: string): string {
  const nl = String.fromCharCode(10);
  const rows = spec.lines.map(
    (l) =>
      `Помещение ${l.index}: пол ${l.area.toFixed(1)} м² `
      + `(покрытие с запасом ${l.flooring.toFixed(1)} м²), `
      + `стены ${l.wallArea.toFixed(1)} м², краска ${l.paint.toFixed(1)} л, `
      + `плинтус ${l.skirting.toFixed(1)} м`,
  );
  const total =
    `ИТОГО: пол ${spec.totals.area.toFixed(1)} м², `
    + `покрытие ${spec.totals.flooring.toFixed(1)} м², `
    + `стены ${spec.totals.wallArea.toFixed(1)} м², `
    + `краска ${spec.totals.paint.toFixed(1)} л, `
    + `плинтус ${spec.totals.skirting.toFixed(1)} м`;

  return [
    `QSpace — спецификация по помещениям`,
    planName,
    "",
    ...rows,
    "",
    total,
    "",
    "Допущения: площадь стен считается по периметру без вычета окон и дверей",
    "(завышение безопаснее занижения); покрытие пола с запасом 5 % на подрезку;",
    "краска из расчёта 0.12 л/м² в два слоя. Это черновик для закупки,",
    "а не проектная документация.",
  ].join(nl);
}
